const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { StaffService } = require('../dist/auth/staff.service');
const { createSessionToken } = require('../dist/auth/crypto');

const status = code => error => error.getStatus() === code;
const input = () => ({ tenantSlug: 'demo-a', username: 'demo.staff', password: randomBytes(32).toString('base64url') });

test('login serializes derivation and releases capacity after a dependency failure', async () => {
  let release;
  let signal;
  const entered = new Promise(resolve => { signal = resolve; });
  const repository = { account: async () => { signal(); return new Promise(resolve => { release = resolve; }); } };
  const service = new StaffService(repository);
  const first = service.login(input(), 'local');
  await entered;
  await assert.rejects(service.login(input(), 'local'), status(429));
  release(null);
  await assert.rejects(first, status(401));
  repository.account = async () => { throw new Error('Dependency unavailable'); };
  await assert.rejects(service.login(input(), 'local'), status(503));
  await assert.rejects(service.login(input(), 'local'), status(503));
});

test('session lookup and revocation failures fail closed', async () => {
  const token = createSessionToken();
  const repository = { session: async () => { throw new Error('Dependency unavailable'); } };
  const service = new StaffService(repository);
  await assert.rejects(service.authenticate(token, 'demo-a'), status(503));
  await assert.rejects(service.authenticate(undefined, 'demo-a'), status(401));
  repository.session = async () => ({ tenantId: 'tenant-a', staffId: 'staff-a', expiresAt: new Date(Date.now() + 60000), revokedAt: null, staff: { id: 'staff-a', tenantId: 'tenant-a', username: 'demo.staff', role: 'staff', isActive: true, tenant: { slug: 'demo-a', status: 'active' } } });
  repository.revoke = async () => { throw new Error('Dependency unavailable'); };
  await assert.rejects(service.logout(token, 'demo-a'), status(503));
});
