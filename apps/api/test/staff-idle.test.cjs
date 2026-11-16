const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StaffService } = require('../dist/auth/staff.service');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { createSessionToken } = require('../dist/auth/crypto');
const { STAFF_IDLE_MS, STAFF_ABSOLUTE_MS, activeStaffSessionWhere } = require('../dist/auth/staff-session-policy');
const unauthorized = error => error.getStatus() === 401;
function fixture(now) {
  const row = { createdAt: new Date(now), lastActivityAt: new Date(now), expiresAt: new Date(now + STAFF_ABSOLUTE_MS), revokedAt: null, tenantId: 'tenant-a', staffId: 'staff-a', staff: { id: 'staff-a', tenantId: 'tenant-a', username: 'synthetic.staff', role: 'staff', isActive: true, tenant: { slug: 'demo-a', status: 'active' } } };
  const repository = { session: async () => row, revoke: async () => { row.revokedAt = new Date(); }, activity: async () => {
    const time = new Date();
    if (row.revokedAt || row.expiresAt <= time || row.createdAt.getTime() <= time.getTime() - STAFF_ABSOLUTE_MS || row.lastActivityAt.getTime() <= time.getTime() - STAFF_IDLE_MS) return { count: 0 };
    if (row.lastActivityAt > time) return { count: 0 };
    row.lastActivityAt = time; return { count: 1 };
  } };
  return { row, repository, service: new StaffService(repository), token: createSessionToken() };
}

test('idle and absolute limits reject exact boundaries; polling never touches activity', async t => {
  const start = Date.UTC(2026, 10, 10); t.mock.timers.enable({ apis: ['Date'], now: start });
  for (const offset of [-1, 0, 1]) {
    const f = fixture(start); t.mock.timers.setTime(start + STAFF_IDLE_MS + offset);
    if (offset < 0) await f.service.authenticate(f.token, 'demo-a'); else await assert.rejects(f.service.authenticate(f.token, 'demo-a'), unauthorized);
    assert.equal(f.row.lastActivityAt.getTime(), start);
  }
  for (const offset of [-1, 0, 1]) {
    const f = fixture(start); f.row.lastActivityAt = new Date(start + STAFF_ABSOLUTE_MS - 1000); f.row.expiresAt = new Date(start + STAFF_ABSOLUTE_MS + 60000);
    t.mock.timers.setTime(start + STAFF_ABSOLUTE_MS + offset);
    if (offset < 0) await f.service.authenticate(f.token, 'demo-a'); else await assert.rejects(f.service.authenticate(f.token, 'demo-a'), unauthorized);
  }
});
test('activity uses server clock without extending absolute expiry; late and revoked activity cannot revive', async t => {
  const start = Date.UTC(2026, 10, 10); t.mock.timers.enable({ apis: ['Date'], now: start });
  const f = fixture(start), expires = f.row.expiresAt.getTime();
  t.mock.timers.setTime(start + 60000); await f.service.activity(f.token, 'demo-a', {});
  assert.equal(f.row.lastActivityAt.getTime(), start + 60000); assert.equal(f.row.expiresAt.getTime(), expires);
  await assert.rejects(f.service.activity(f.token, 'demo-a', { timestamp: start + 999999 }), error => error.getStatus() === 400);
  t.mock.timers.setTime(start + 60000 + STAFF_IDLE_MS);
  await assert.rejects(f.service.activity(f.token, 'demo-a', {}), unauthorized);
  assert.equal(f.row.lastActivityAt.getTime(), start + 60000);
  t.mock.timers.setTime(start + 120000); await f.service.logout(f.token, 'demo-a');
  await assert.rejects(f.service.activity(f.token, 'demo-a', {}), unauthorized);
});
test('guarded activity update rechecks revocation after authentication', async t => {
  const start = Date.UTC(2026, 10, 10); t.mock.timers.enable({ apis: ['Date'], now: start });
  const f = fixture(start);
  f.repository.activity = async () => { f.row.revokedAt = new Date(); return { count: 0 }; };
  await assert.rejects(f.service.activity(f.token, 'demo-a', {}), unauthorized);
});
test('repository activity locks before reading database clock and preserves eligibility predicates', async () => {
  const repository = Object.create(StaffRepository.prototype), now = new Date('2026-11-10T00:00:00Z');
  const calls = [];
  repository.database = { $transaction: async (run, options) => {
    assert.deepEqual(options, { isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 5000 });
    return run({ $queryRaw: async (sql, ...params) => {
      calls.push(sql.join('?'));
      if (calls.length === 1) {
        assert.match(calls[0], /WHERE token_hash = \? FOR UPDATE/);
        assert.deepEqual(params, ['synthetic-hash']); return [{ id: 'session-a' }];
      }
      assert.match(calls[1], /SELECT clock_timestamp\(\) AS now/); return [{ now }];
    }, staffSession: { updateMany: async args => {
      assert.equal(calls.length, 2); assert.equal(args.where.id, 'session-a'); assert.equal(args.where.tokenHash, 'synthetic-hash');
      assert.deepEqual(args.where.expiresAt, { gt: now });
      assert.equal(args.where.lastActivityAt.gt.getTime(), now.getTime() - STAFF_IDLE_MS);
      assert.equal(args.where.createdAt.gt.getTime(), now.getTime() - STAFF_ABSOLUTE_MS);
      assert.equal(args.where.revokedAt, null); assert.equal(args.where.staff.tenant.slug, 'demo-a');
      assert.equal(args.where.staff.tenant.status, 'active');
      assert.deepEqual(args.where.staff.role.in, ['owner', 'staff']); assert.equal(args.where.staff.isActive, true);
      assert.equal(args.where.lastActivityAt.lte, now); assert.deepEqual(args.data, { lastActivityAt: now });
      return { count: 1 };
    } } });
  } };
  assert.deepEqual(await repository.activity('synthetic-hash', 'demo-a'), { count: 1 });
  assert.equal(activeStaffSessionWhere(now).lastActivityAt.gt.getTime(), now.getTime() - STAFF_IDLE_MS);
});
test('activity waiting for session lock cannot revive idle expiry; just-before-deadline touch stays within absolute limit', async t => {
  const start = Date.UTC(2026, 10, 10); t.mock.timers.enable({ apis: ['Date'], now: start });
  for (const waitUntil of [STAFF_IDLE_MS - 1, STAFF_IDLE_MS, STAFF_IDLE_MS + 1]) {
    t.mock.timers.setTime(start + STAFF_IDLE_MS - 2);
    const f = fixture(start), repository = Object.create(StaffRepository.prototype);
    repository.database = { $transaction: async run => run({
      $queryRaw: async sql => {
        if (sql.join('').includes('FOR UPDATE')) {
          t.mock.timers.setTime(start + waitUntil); return [{ id: 'session-a' }];
        }
        return [{ now: new Date() }];
      },
      staffSession: { updateMany: async ({ where, data }) => {
        if (f.row.lastActivityAt <= where.lastActivityAt.gt || f.row.createdAt <= where.createdAt.gt || f.row.expiresAt <= where.expiresAt.gt) return { count: 0 };
        f.row.lastActivityAt = data.lastActivityAt; return { count: 1 };
      } },
    }) };
    f.repository.activity = repository.activity.bind(repository);
    if (waitUntil < STAFF_IDLE_MS) {
      const result = await f.service.activity(f.token, 'demo-a', {});
      assert.equal(result.validUntil, start + waitUntil + STAFF_IDLE_MS);
      assert.equal(f.row.lastActivityAt.getTime(), start + waitUntil);
    } else {
      await assert.rejects(f.service.activity(f.token, 'demo-a', {}), unauthorized);
      assert.equal(f.row.lastActivityAt.getTime(), start);
    }
    assert.equal(f.row.expiresAt.getTime(), start + STAFF_ABSOLUTE_MS);
  }
  const f = fixture(start);
  f.row.lastActivityAt = new Date(start + STAFF_ABSOLUTE_MS - 1000);
  t.mock.timers.setTime(start + STAFF_ABSOLUTE_MS - 1);
  assert.equal((await f.service.activity(f.token, 'demo-a', {})).validUntil, start + STAFF_ABSOLUTE_MS);
});
