const { test } = require('node:test');
const assert = require('node:assert/strict');
const spec = require('../../../docs/api/openapi.json');

test('OpenAPI documents implemented routes and resolves schemas', () => {
  assert.equal(spec.openapi, '3.1.1');
  assert.deepEqual(Object.keys(spec.paths).sort(), ['/health', '/public/tenants/{slug}/restaurant', '/staff/{slug}/hours/{dayOfWeek}', '/staff/{slug}/menu/{id}', '/staff/{slug}/tables/{id}', '/staff/login', '/staff/logout'].sort());
  const ids = new Set();
  for (const path of Object.values(spec.paths)) {
    for (const operation of Object.values(path)) {
      assert.ok(!ids.has(operation.operationId));
      ids.add(operation.operationId);
    }
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
