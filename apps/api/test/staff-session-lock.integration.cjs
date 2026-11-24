const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { createDatabaseClient } = require('../dist/database/client');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { StaffService } = require('../dist/auth/staff.service');
const { StaffController } = require('../dist/auth/staff.controller');
const { StaffOrdersService } = require('../dist/restaurant/staff-orders.service');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');

const enabled = process.env.ALLOW_LOCAL_STAFF_SESSION_WRITES === 'true';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('independent PostgreSQL row locks cannot revive staff sessions across deadlines', { skip: !enabled, timeout: 30000 }, async t => {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.ok(['15432', '55432'].includes(url.port));
  assert.match(url.pathname, /^\/session_verify_[a-f0-9]{16}$/);
  const observer = createDatabaseClient(), blocker = createDatabaseClient(), activityDb = createDatabaseClient();
  const repository = Object.create(StaffRepository.prototype);
  let activityPid;
  repository.database = {
    staffSession: activityDb.staffSession,
    $transaction: (run, options) => activityDb.$transaction(async tx => {
      const [row] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
      activityPid = row.pid;
      return run(tx);
    }, options),
  };
  const service = new StaffService(repository);
  const orders = Object.create(StaffOrdersService.prototype); orders.db = observer;
  class TestModule {}
  Module({ controllers: [StaffController], providers: [{ provide: StaffService, useValue: service }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(new ApiErrorFilter());
  const tenantIds = [], originalOrigin = process.env.STAFF_ORIGIN;
  const token = createSessionToken(), tokenHash = hashSessionToken(token);
  try {
    await app.listen(0, '127.0.0.1');
    process.env.STAFF_ORIGIN = await app.getUrl();
    const tenant = await observer.tenant.create({ data: { slug: `lock-probe-${randomUUID()}`, name: 'Synthetic lock probe' } }); tenantIds.push(tenant.id);
    const other = await observer.tenant.create({ data: { slug: `lock-probe-${randomUUID()}`, name: 'Synthetic other probe' } }); tenantIds.push(other.id);
    const staff = await observer.staff.create({ data: { tenantId: tenant.id, username: 'synthetic.staff', passwordHash: 'unusable-synthetic-hash', role: 'staff' } });
    const session = await observer.staffSession.create({ data: { tenantId: tenant.id, staffId: staff.id, tokenHash, expiresAt: new Date(Date.now() + 28800000) } });
    const post = (slug = tenant.slug, origin = process.env.STAFF_ORIGIN) => fetch(`${process.env.STAFF_ORIGIN}/staff/tenants/${slug}/activity`, { method: 'POST', headers: { cookie: `restaurant_staff=${token}`, origin, 'content-type': 'application/json' }, body: '{}' });
    const read = () => observer.staffSession.findUnique({ where: { id: session.id } });
    const reset = () => observer.$executeRaw`UPDATE staff_sessions SET created_at = clock_timestamp(), last_activity_at = clock_timestamp() - interval '5 minutes', expires_at = clock_timestamp() + interval '8 hours', revoked_at = NULL WHERE id = ${session.id}::uuid`;
    await reset();
    const freshBefore = await read();
    const freshResponse = await post(); assert.equal(freshResponse.status, 200);
    const freshAfter = await read();
    assert.ok(freshAfter.lastActivityAt > freshBefore.lastActivityAt);
    assert.equal(freshAfter.expiresAt.getTime(), freshBefore.expiresAt.getTime());
    const freshBody = await freshResponse.json();
    assert.equal(freshBody.data.validUntil, Math.min(freshAfter.lastActivityAt.getTime() + 1800000, freshAfter.createdAt.getTime() + 28800000, freshAfter.expiresAt.getTime()));

    for (const boundary of ['idle', 'absolute', 'expires']) {
      await reset();
      if (boundary === 'idle') await observer.$executeRaw`UPDATE staff_sessions SET last_activity_at = clock_timestamp() - interval '30 minutes' + interval '2 seconds' WHERE id = ${session.id}::uuid`;
      if (boundary === 'absolute') await observer.$executeRaw`UPDATE staff_sessions SET created_at = clock_timestamp() - interval '8 hours' + interval '2 seconds' WHERE id = ${session.id}::uuid`;
      if (boundary === 'expires') await observer.$executeRaw`UPDATE staff_sessions SET expires_at = clock_timestamp() + interval '2 seconds' WHERE id = ${session.id}::uuid`;
      const before = await read();
      const deadline = new Date(Math.min(before.lastActivityAt.getTime() + 1800000, before.createdAt.getTime() + 28800000, before.expiresAt.getTime()));
      activityPid = undefined;
      let responsePromise;
      await blocker.$transaction(async tx => {
        const [locked] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid, id FROM staff_sessions WHERE id = ${session.id}::uuid FOR UPDATE`;
        responsePromise = post();
        let proof;
        for (let attempt = 0; attempt < 100; attempt++) {
          if (activityPid) {
            const [row] = await observer.$queryRaw`SELECT pid, wait_event_type, xact_start < ${deadline}::timestamptz AS started_before_deadline, clock_timestamp() < ${deadline}::timestamptz AS waiting_before_deadline, ${locked.pid}::int = ANY(pg_blocking_pids(pid)) AS blocked_by_owner, EXISTS (SELECT 1 FROM pg_locks WHERE pg_locks.pid = a.pid AND NOT granted) AS ungranted_lock FROM pg_stat_activity a WHERE pid = ${activityPid}::int`;
            if (row?.wait_event_type === 'Lock' && row.blocked_by_owner && row.ungranted_lock) { proof = row; break; }
          }
          await delay(10);
        }
        assert.ok(proof, 'Activity must actually wait on independent row lock');
        assert.notEqual(locked.pid, proof.pid);
        assert.equal(proof.started_before_deadline, true);
        assert.equal(proof.waiting_before_deadline, true);
        let crossed = false;
        for (let attempt = 0; attempt < 300; attempt++) {
          const [clock] = await observer.$queryRaw`SELECT clock_timestamp() > ${deadline}::timestamptz + interval '100 milliseconds' AS crossed`;
          if (clock.crossed) { crossed = true; break; }
          await delay(10);
        }
        assert.equal(crossed, true);
        t.diagnostic(`${boundary}: blocker PID ${locked.pid}, activity PID ${proof.pid}; pg_stat_activity Lock, pg_locks ungranted, pg_blocking_pids owner; request before deadline, release after deadline`);
      }, { timeout: 8000 });
      const response = await responsePromise;
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
      const after = await read();
      assert.equal(after.lastActivityAt.getTime(), before.lastActivityAt.getTime());
      assert.equal(after.expiresAt.getTime(), before.expiresAt.getTime());
      assert.equal(after.revokedAt, null);
      assert.equal((await post()).status, 401);
    }

    await reset();
    assert.equal((await post(other.slug)).status, 401);
    assert.equal((await post(tenant.slug, 'https://foreign.invalid')).status, 403);
    await assert.rejects(service.authenticate(token, tenant.slug, ['owner']), error => error.getStatus() === 403);
    const deniedBefore = await read();
    await observer.staff.update({ where: { id: staff.id }, data: { isActive: false } });
    assert.equal((await post()).status, 401);
    await observer.staff.update({ where: { id: staff.id }, data: { isActive: true } });
    await observer.tenant.update({ where: { id: tenant.id }, data: { status: 'inactive' } });
    assert.equal((await post()).status, 401);
    await observer.tenant.update({ where: { id: tenant.id }, data: { status: 'active' } });
    assert.equal((await read()).lastActivityAt.getTime(), deniedBefore.lastActivityAt.getTime());
    await observer.staffSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    assert.equal((await post()).status, 401);
    assert.equal((await read()).lastActivityAt.getTime(), deniedBefore.lastActivityAt.getTime());

    const orderIds = [];
    for (let index = 0; index < 22; index++) {
      const order = await observer.order.create({ data: { tenantId: index === 21 ? other.id : tenant.id, code: `SYNTHETIC-${randomUUID()}`, customerName: 'Synthetic guest', orderTotal: 50000, items: [{ name: 'Synthetic dish', price: 25000, quantity: 2 }], idempotencyKey: randomUUID(), snapToken: 'synthetic-private-snap', redirectUrl: 'https://synthetic.invalid/private', paymentStatus: index % 2 ? 'pending' : 'unpaid' } });
      orderIds.push(order.id);
    }
    await observer.orderPaymentEvent.create({ data: { tenantId: tenant.id, orderId: orderIds[0], fromStatus: 'unpaid', toStatus: 'pending' } });
    const first = await orders.list(tenant.id, {}), second = await orders.list(tenant.id, { page: '2' });
    assert.equal(first.total, 21); assert.equal(first.data.length, 20); assert.equal(second.data.length, 1);
    assert.equal(new Set([...first.data, ...second.data].map(row => row.id)).size, 21);
    assert.equal(first.data.some(row => row.id === orderIds[21]), false);
    assert.equal((await orders.list(tenant.id, { paymentStatus: 'pending' })).total, 10);
    const detail = await orders.detail(tenant.id, orderIds[0]);
    assert.equal(detail.data.items[0].subtotal, 50000); assert.equal(detail.data.paymentEvents.length, 1);
    assert.deepEqual(Object.keys(first.data[0]).sort(), ['code', 'createdAt', 'id', 'orderTotal', 'paymentStatus', 'status']);
    assert.deepEqual(Object.keys(detail.data).sort(), ['code', 'createdAt', 'customerName', 'id', 'items', 'orderTotal', 'paymentEvents', 'paymentStatus', 'status']);
    assert.equal(JSON.stringify({ first, second, detail }).includes('synthetic-private'), false);
    await assert.rejects(orders.detail(other.id, orderIds[0]), error => error.getStatus() === 404);
    t.diagnostic('Fresh activity resets idle only; inactive/revoked/wrong-tenant deny, restricted role and Origin 403; real order pagination 20+1, tenant isolation, payment snapshot and private-field allowlists passed');
  } finally {
    if (originalOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = originalOrigin;
    await app.close();
    try {
      await observer.orderPaymentEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await observer.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await observer.staffSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await observer.staff.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await observer.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    } finally { await Promise.all([observer.$disconnect(), blocker.$disconnect(), activityDb.$disconnect()]); }
  }
});
