const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

function route(cookieValues, capability = false) {
  const filename = resolve(__dirname, capability ? '../../web/app/chat/orders/capabilities/route.ts' : '../../web/app/chat/orders/[id]/route.ts');
  const instance = new Module(filename);
  instance.require = name => {
    if (name === 'next/server') return { NextResponse: { json: Response.json } };
    if (name === 'next/headers') return { cookies: async () => ({ getAll: () => cookieValues }) };
    if (name === '../../../staff-session') return { API_ORIGIN: 'http://127.0.0.1:3001', trustedOrigin: request => request.headers.get('origin') === 'http://127.0.0.1:3000' };
    throw new Error('Unexpected import');
  };
  instance._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return instance.exports.GET;
}

test('private order GET permits missing Origin, forwards only actual trusted Origin and rejects cross-site reads', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  const token = 's'.repeat(43), id = randomUUID(), get = route([{ value: token }]);
  let calls = 0, forwarded;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, `http://127.0.0.1:3001/api/v1/chat/orders/${id}/status`);
    assert.equal(options.headers.cookie, `restaurant_chat=${token}`);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    forwarded = options.headers.origin;
    return Response.json({ data: { paymentStatus: 'pending' } });
  };
  for (const headers of [{}, { origin: 'http://127.0.0.1:3000' }]) {
    const result = await get(new Request(`http://127.0.0.1:3000/chat/orders/${id}`, { headers }), { params: Promise.resolve({ id }) });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(forwarded, headers.origin);
  }
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const result = await get(new Request(`http://127.0.0.1:3000/chat/orders/${id}`, { headers }), { params: Promise.resolve({ id }) });
    assert.equal(result.status, 403);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 2);
});

test('capability GET preserves private cookie and backend boolean, rejects foreign reads and fails closed', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  const token = 's'.repeat(43), get = route([{ value: token }], true);
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'http://127.0.0.1:3001/api/v1/chat/orders/capabilities');
    assert.equal(options.headers.cookie, `restaurant_chat=${token}`);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    return Response.json({ data: { paymentsEnabled: false } });
  };
  for (const headers of [{}, { origin: 'http://127.0.0.1:3000' }]) {
    const result = await get(new Request('http://127.0.0.1:3000/chat/orders/capabilities', { headers }));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await result.json(), { data: { paymentsEnabled: false } });
  }
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await get(new Request('http://127.0.0.1:3000/chat/orders/capabilities', { headers }))).status, 403);
  }
  for (const values of [[], [{ value: token }, { value: token }], [{ value: 'invalid' }]]) {
    const result = await route(values, true)(new Request('http://127.0.0.1:3000/chat/orders/capabilities'));
    assert.equal(result.status, 403);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 2);
  global.fetch = async () => { throw new Error('Synthetic unavailable API'); };
  const unavailable = await get(new Request('http://127.0.0.1:3000/chat/orders/capabilities'));
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
});

test('private order GET errors remain no-store and never retry provider', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  const id = randomUUID(), request = new Request(`http://127.0.0.1:3000/chat/orders/${id}`);
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Synthetic API error'); };
  for (const [values, orderId, expected] of [[[], id, 403], [[{ value: 's'.repeat(43) }], 'invalid', 404], [[{ value: 's'.repeat(43) }], id, 503]]) {
    const result = await route(values)(request, { params: Promise.resolve({ id: orderId }) });
    assert.equal(result.status, expected);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 1);
});
