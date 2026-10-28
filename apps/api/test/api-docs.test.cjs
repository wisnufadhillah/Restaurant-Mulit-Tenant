const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerApiDocs } = require('../dist/api-docs');

test('Scalar docs use pinned bundle, local specification and disable credential features', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'test';
    const routes = new Map();
    registerApiDocs({ getHttpAdapter: () => ({ get: (path, handler) => routes.set(path, handler) }) });
    let html;
    routes.get('/docs')({}, { type: () => {}, setHeader: () => {}, send: value => { html = value; } });
    assert.ok(html.includes('@scalar/api-reference@1.76.0/dist/browser/standalone.js'));
    for (const option of ['agent: { disabled: true }', 'telemetry: false', 'persistAuth: false', 'hideTestRequestButton: true', "url: '/openapi.json'", "proxyUrl: ''"]) assert.ok(html.includes(option));
    let spec;
    routes.get('/openapi.json')({}, { json: value => { spec = value; } });
    assert.equal(spec.openapi, '3.1.1');
    assert.ok(spec.paths['/staff/login']);
    process.env.NODE_ENV = 'production';
    registerApiDocs({ getHttpAdapter: () => { throw new Error('Production docs must be disabled'); } });
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
