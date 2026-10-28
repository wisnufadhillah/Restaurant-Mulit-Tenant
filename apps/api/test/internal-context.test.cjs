const { test } = require('node:test');
const assert = require('node:assert/strict');
const { signInternalContext, verifyInternalContext } = require('../dist/restaurant/internal-context.js');

test('internal context is tenant and session bound and expires', () => {
  const token = signInternalContext({ tenantSlug: 'demo-padang', sessionId: 'session-a', expiresAt: 2000 }, 'synthetic-secret');
  assert.equal(verifyInternalContext(token, 'demo-padang', 'session-a', 'synthetic-secret', 1000), true);
  assert.equal(verifyInternalContext(token, 'demo-keluarga', 'session-a', 'synthetic-secret', 1000), false);
  assert.equal(verifyInternalContext(token, 'demo-padang', 'session-b', 'synthetic-secret', 1000), false);
  assert.equal(verifyInternalContext(token, 'demo-padang', 'session-a', 'synthetic-secret', 2000), false);
  assert.equal(verifyInternalContext(`${token}x`, 'demo-padang', 'session-a', 'synthetic-secret', 1000), false);
});
