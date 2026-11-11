const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load() {
  const filename = resolve(__dirname, '../../web/app/staff-session.ts');
  const instance = new Module(filename);
  instance.require = name => {
    if (name === 'server-only') return {};
    if (name === 'next/headers') return { cookies: async () => { throw Error('Not used'); } };
    throw Error('Unexpected import');
  };
  instance._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return instance.exports.trustedOrigin;
}

test('web default development origin permits local login but rejects foreign and production defaults', () => {
  const oldMode = process.env.NODE_ENV, oldOrigin = process.env.STAFF_ORIGIN;
  const request = (origin, site = 'same-origin') => new Request('http://127.0.0.1:3000/staff/login', { headers: { origin, 'sec-fetch-site': site } });
  try {
    process.env.NODE_ENV = 'development'; delete process.env.STAFF_ORIGIN;
    const trusted = load();
    assert.equal(trusted(request('http://127.0.0.1:3000')), true);
    assert.equal(trusted(request('http://localhost:3000')), true);
    assert.equal(trusted(request('https://foreign.example')), false);
    assert.equal(trusted(request('http://127.0.0.1:3000', 'cross-site')), false);
    process.env.NODE_ENV = 'production';
    assert.equal(trusted(request('http://127.0.0.1:3000')), false);
    process.env.STAFF_ORIGIN = 'https://restaurant.example';
    assert.equal(trusted(request('https://restaurant.example')), true);
    assert.equal(trusted(request('http://localhost:3000')), false);
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
    if (oldOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = oldOrigin;
  }
});
