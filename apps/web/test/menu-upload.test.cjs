const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function route() {
  const forwarded = [];
  const source = readFileSync(resolve(__dirname, '../app/staff/menu/images/route.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const dependencies = {
    'next/headers': { cookies: async () => ({ getAll: name => [{ value: name === 'session' ? 'a'.repeat(43) : 'demo-padang' }] }) },
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../staff-session': { API_ORIGIN: 'https://api.example.invalid', SESSION_COOKIE: 'session', TENANT_COOKIE: 'tenant', trustedOrigin: () => true },
    '../../../../../api/src/menu/menu-images': { uploadedMenuImage: () => false },
  };
  vm.runInNewContext(compiled, {
    exports: module.exports, module,
    require: name => { assert.ok(name in dependencies); return dependencies[name]; },
    Response, Request, URL, Buffer, Uint8Array, AbortSignal, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      if (url.endsWith('/session')) return Response.json({ data: { role: 'owner' } });
      forwarded.push(options.body);
      return Response.json({ data: { imageKey: 'synthetic' } }, { status: 201 });
    },
  });
  return { POST: module.exports.POST, forwarded };
}

function request(size, declared) {
  const headers = { origin: 'https://frontend.example.invalid', 'content-type': 'image/png' };
  if (declared !== undefined) headers['content-length'] = String(declared);
  return new Request('https://frontend.example.invalid/staff/menu/images', { method: 'POST', headers, body: new Uint8Array(size) });
}

test('upload BFF rejects declared and streamed bytes beyond decimal ceiling', async () => {
  for (const declared of [4_000_001, undefined]) {
    const { POST, forwarded } = route();
    assert.equal((await POST(request(4_000_001, declared))).status, 413);
    assert.equal(forwarded.length, 0);
  }
});

test('upload BFF forwards raw bytes at and below decimal ceiling, never base64', async () => {
  for (const size of [3_999_999, 4_000_000]) {
    const { POST, forwarded } = route();
    assert.equal((await POST(request(size, size))).status, 201);
    assert.equal(forwarded.length, 1);
    assert.ok(forwarded[0] instanceof Uint8Array);
    assert.equal(forwarded[0].byteLength, size);
  }
});
