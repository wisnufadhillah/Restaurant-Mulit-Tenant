const { test } = require('node:test');
const assert = require('node:assert/strict');
const spec = require('../../../docs/api/openapi.json');

test('OpenAPI documents only currently implemented GET routes and resolves schemas', () => {
  assert.equal(spec.openapi, '3.1.1');
  assert.deepEqual(Object.keys(spec.paths).sort(), ['/health', '/public/tenants/{slug}/restaurant']);
  const ids = new Set();
  for (const path of Object.values(spec.paths)) {
    assert.deepEqual(Object.keys(path), ['get']);
    assert.ok(!ids.has(path.get.operationId));
    ids.add(path.get.operationId);
  }
  function check(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const name = value.$ref.replace('#/components/schemas/', '');
      assert.ok(spec.components.schemas[name]);
    }
    for (const child of Object.values(value)) check(child);
  }
  check(spec);
});
