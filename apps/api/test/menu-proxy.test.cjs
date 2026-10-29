const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const ts = require('typescript');
const Module = require('node:module');

test('menu proxy classifies dependency failures, preserves access errors and never retries writes', async () => {
  const filename = resolve(__dirname, '../../web/app/staff/menu/route.ts');
  const token = randomBytes(32).toString('base64url');
  const instance = new Module(filename);
  instance.require = name => {
    if (name === 'next/server') return { NextResponse: { json: Response.json } };
    if (name === 'next/headers') return { cookies: async () => ({ getAll: key => [{ value: key === 'senja_staff' ? token : 'demo-padang' }] }) };
    if (name === '../../staff-session') return { API_ORIGIN: 'http://127.0.0.1:3001', SESSION_COOKIE: 'senja_staff', TENANT_COOKIE: 'senja_staff_tenant', trustedOrigin: () => true };
    throw new Error('Unexpected import');
  };
  instance._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  const original = global.fetch;
  try {
    for (const scenario of [
      { result: () => { throw new TypeError('Synthetic failure'); }, status: 503, code: 'MENU_CONNECTION_FAILED' },
      { result: () => { throw new DOMException('Synthetic timeout', 'TimeoutError'); }, status: 503, code: 'MENU_TIMEOUT' },
      ...[400, 401, 403, 404, 503].map(status => ({ result: () => Response.json({ privateDetail: 'Synthetic internals' }, { status }), status, code: 'MENU_UPSTREAM_REJECTED' })),
    ]) {
      let calls = 0;
      global.fetch = async () => { calls++; return scenario.result(); };
      const response = await instance.exports.POST(new Request('http://127.0.0.1:3000/staff/menu', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Synthetic menu' }) }));
      assert.equal(response.status, scenario.status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.code, scenario.code);
      assert.ok(!JSON.stringify(body).includes(token));
      assert.ok(!JSON.stringify(body).includes('Synthetic internals'));
      assert.equal(calls, 1);
    }
  } finally { global.fetch = original; }
});
