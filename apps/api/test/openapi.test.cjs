const { test } = require('node:test');
const assert = require('node:assert/strict');
const spec = require('../../../docs/api/openapi.json');

test('OpenAPI documents implemented routes, session security and schema references', () => {
  assert.equal(spec.openapi, '3.1.1');
  assert.deepEqual(Object.keys(spec.paths).sort(), ['/chat/catalogue/{resource}', '/chat/messages', '/chat/session', '/health', '/internal/tenants/{slug}/menu', '/internal/tenants/{slug}/restaurant', '/public/tenants/{slug}/hours', '/public/tenants/{slug}/menu', '/public/tenants/{slug}/restaurant', '/staff/login', '/staff/tenants/{slug}/hours', '/staff/tenants/{slug}/logout', '/staff/tenants/{slug}/menu', '/staff/tenants/{slug}/menu/{id}', '/staff/tenants/{slug}/menu/{id}/availability', '/staff/tenants/{slug}/profile', '/staff/tenants/{slug}/session', '/staff/tenants/{slug}/special-hours', '/staff/tenants/{slug}/special-hours/{date}', '/staff/tenants/{slug}/tables', '/staff/tenants/{slug}/tables/{id}']);
  const ids = new Set();
  for (const path of Object.values(spec.paths)) {
    for (const operation of Object.values(path)) {
      assert.ok(!ids.has(operation.operationId));
      ids.add(operation.operationId);
      assert.ok(operation.responses['500'], 'Unexpected server errors must be documented');
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) >= 400) {
          assert.equal(response.content['application/json'].schema.$ref, '#/components/schemas/ApiError');
          assert.ok(response.content['application/json'].example.error.code);
        }
      }
    }
  }
  assert.deepEqual(spec.paths['/staff/tenants/{slug}/session'].get.security, [{ staffCookie: [] }]);
  assert.equal(spec.components.securitySchemes.staffCookie.in, 'cookie');
  function check(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const name = value.$ref.replace('#/components/schemas/', '');
      assert.ok(spec.components.schemas[name]);
    }
    for (const child of Object.values(value)) check(child);
  }
  check(spec);
  assert.ok(spec.paths['/staff/login'].post.responses['429']);
  assert.ok(spec.paths['/staff/tenants/{slug}/tables'].post.responses['201']);
  assert.equal(spec.paths['/staff/tenants/{slug}/tables'].post.responses['200'], undefined);
  assert.ok(spec.paths['/staff/tenants/{slug}/tables/{id}'].patch.responses['404']);
  assert.ok(spec.paths['/staff/tenants/{slug}/logout'].post.responses['204']);
  assert.equal(spec.paths['/staff/tenants/{slug}/logout'].post.responses['204'].content, undefined);
});
