const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const ts = require('typescript');
const Module = require('node:module');

// Execute the real route with only Next response and server configuration adapters replaced.
function route() {
  const filename = resolve(__dirname, '../../web/app/staff/login/route.ts');
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const instance = new Module(filename);
  instance.require = name => {
    if (name === 'next/server') return { NextResponse: { json(body, options) { const response = Response.json(body, options); response.cookies = { set() { throw new Error('Failure must not set cookies'); } }; return response; } } };
    if (name === '../../staff-session') return { API_ORIGIN: 'http://127.0.0.1:3001', trustedOrigin: request => request.headers.get('origin') === 'http://127.0.0.1:3000' };
    throw new Error('Unexpected route import');
  };
  instance._compile(output, filename);
  return instance.exports.POST;
}

test('login proxy safely classifies controlled failures without retries or credential reflection', async () => {
  const post = route(), originalFetch = global.fetch;
  const password = randomBytes(24).toString('base64url');
  const scenarios = [
    { fetch: async () => { throw new TypeError('Synthetic network failure'); }, status: 503, code: 'LOGIN_CONNECTION_FAILED' },
    { fetch: async () => { throw new DOMException('Synthetic deadline', 'TimeoutError'); }, status: 503, code: 'LOGIN_TIMEOUT' },
    { fetch: async () => Response.json({ error: 'Synthetic unavailable' }, { status: 503 }), status: 503, code: 'LOGIN_UPSTREAM_UNAVAILABLE' },
    { fetch: async () => Response.json({}, { status: 429 }), status: 429, code: 'LOGIN_RATE_LIMITED' },
    { fetch: async () => Response.json({}, { status: 401 }), status: 401, code: 'LOGIN_REJECTED' },
    { fetch: async () => Response.json({ ok: true }), status: 502, code: 'LOGIN_INVALID_RESPONSE' },
  ];
  try {
    for (const scenario of scenarios) {
      let calls = 0;
      global.fetch = async (...args) => { calls++; return scenario.fetch(...args); };
      const request = new Request('http://127.0.0.1:3000/staff/login', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify({ tenantSlug: 'demo-padang', username: 'synthetic.owner', password }) });
      const response = await post(request);
      assert.equal(response.status, scenario.status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('set-cookie'), null);
      const body = await response.json();
      assert.equal(body.code, scenario.code);
      assert.equal(calls, 1);
      assert.ok(!JSON.stringify(body).includes(password));
      assert.ok(!JSON.stringify(body).includes('Synthetic'));
      assert.ok(!('stack' in body));
    }
  } finally { global.fetch = originalFetch; }
});
