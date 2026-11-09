const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

test('reservation proxy accepts only recognized recovery outcomes and never retries', async () => {
  const filename = resolve(__dirname, '../../web/app/reservation/[action]/route.ts');
  const instance = new Module(filename);
  instance.require = name => {
    if (name === 'next/server') return { NextResponse: { json: Response.json } };
    if (name === 'next/headers') return { cookies: async () => ({ getAll: () => [] }) };
    if (name === '../../staff-session') return { API_ORIGIN: 'http://127.0.0.1:3001', trustedOrigin: () => true };
    throw new Error('Unexpected import');
  };
  instance._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  const original = global.fetch;
  try {
    for (const outcome of ['not_created', 'reservation_exists', 'unknown', null]) {
      let calls = 0;
      global.fetch = async (url, options) => {
        calls++;
        assert.ok(url.endsWith('/reservations/recovery'));
        assert.equal(options.headers['idempotency-key'], 'synthetic-request-key');
        return Response.json({ data: { outcome } });
      };
      const response = await instance.exports.POST(new Request('http://127.0.0.1:3000/reservation/recovery', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', 'idempotency-key': 'synthetic-request-key' }, body: '{}' }), { params: Promise.resolve({ action: 'recovery' }) });
      assert.equal(response.status, ['not_created', 'reservation_exists'].includes(outcome) ? 200 : 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(calls, 1);
    }
  } finally { global.fetch = original; }
});
