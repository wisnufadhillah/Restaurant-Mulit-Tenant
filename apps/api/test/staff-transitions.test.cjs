const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { StaffReservationsService, staffAuditQuery } = require('../dist/restaurant/staff-reservations.service');

function fixture() {
  const tenantId = randomUUID(), staffId = randomUUID(), id = randomUUID(), key = randomUUID();
  const service = Object.create(StaffReservationsService.prototype);
  service.attempts = new Map();
  const state = { status: 'confirmed', events: [], active: true, failEvent: false, updates: 0 };
  const tx = {
    $executeRaw: async () => 1,
    staffSession: { findFirst: async args => { assert.equal(args.where.tenantId, tenantId); assert.equal(args.where.staffId, staffId); assert.equal(args.where.tokenHash, 'synthetic-hash'); assert.equal(args.where.revokedAt, null); assert.deepEqual(args.where.staff.role.in, ['owner', 'staff']); return state.active ? { staffId } : null; } },
    reservation: { findFirst: async args => args.where.id === id ? { id, status: state.status, endAt: new Date(0) } : null, updateMany: async args => { state.updates++; assert.equal(args.where.status, 'confirmed'); state.status = args.data.status; return { count: 1 }; } },
    reservationEvent: { findUnique: async args => state.events.find(event => event.id === args.where.id) ?? null, create: async ({ data }) => { if (state.failEvent) throw new Error('Private DB failure'); state.events.push(data); return data; } },
  };
  service.db = { $transaction: async callback => { const before = structuredClone(state); try { return await callback(tx); } catch (error) { Object.assign(state, before); throw error; } } };
  const send = (body = { status: 'cancelled', reason: 'Reason' }, eventKey = key, reservationId = id, actor = staffId) => service.transition(tenantId, actor, 'synthetic-hash', reservationId, eventKey, body);
  return { service, state, tx, tenantId, staffId, id, key, send };
}
test('staff transition writes one atomic event and replays minimized durable receipt', async () => {
  const f = fixture();
  const first = await f.send();
  assert.deepEqual(Object.keys(first.data).sort(), ['changedAt', 'eventId', 'reservationId', 'status']);
  assert.equal(first.data.eventId, f.key); assert.equal(first.data.status, 'cancelled');
  assert.deepEqual(await f.send({ status: 'cancelled', reason: '  Reason  ' }), first);
  assert.equal(f.state.events.length, 1); assert.equal(f.state.updates, 1);
  for (const body of [{ status: 'cancelled', reason: 'Different' }, { status: 'completed' }, { status: 'no_show', reviewed: true }]) await assert.rejects(f.send(body), e => e.getStatus() === 409);
  await assert.rejects(f.send(undefined, randomUUID()), e => e.getStatus() === 409);
});
test('staff replay binds actor, tenant, resource and operation; foreign reservation stays hidden', async () => {
  for (const field of ['staffId', 'tenantId', 'reservationId', 'actorType', 'fromStatus']) {
    const f = fixture(); await f.send(); f.state.events[0][field] = field === 'actorType' ? 'customer' : field === 'fromStatus' ? null : randomUUID();
    await assert.rejects(f.send(), e => e.getStatus() === 409);
  }
  const f = fixture(); await assert.rejects(f.send(undefined, f.key, randomUUID()), e => e.getStatus() === 404);
});
test('staff actor revalidation and event failure leave confirmed reservation unchanged', async () => {
  const f = fixture(); f.state.active = false;
  await assert.rejects(f.send(), e => e.getStatus() === 401); assert.equal(f.state.status, 'confirmed');
  f.state.active = true; f.state.failEvent = true;
  await assert.rejects(f.send(), e => e.getStatus() === 503); assert.equal(f.state.status, 'confirmed'); assert.equal(f.state.events.length, 0);
  f.state.failEvent = false; await f.send(); f.state.active = false;
  await assert.rejects(f.send(), e => e.getStatus() === 401);
});
test('staff transitions validate UUID keys and apply bounded actor rate limit', async () => {
  const f = fixture(); await assert.rejects(f.send(undefined, 'not-a-uuid'), e => e.getStatus() === 400);
  f.service.attempts.set(`${f.tenantId}:${f.staffId}`, { count: 60, until: Date.now() + 60000 });
  await assert.rejects(f.send(), e => e.getStatus() === 429);
});
test('audit pagination is strict and SQL union projects no private fields in consistent snapshot', async () => {
  assert.equal(staffAuditQuery({}), 1); assert.equal(staffAuditQuery({ page: '999' }), 999);
  for (const input of [{ page: ['1', '2'] }, { page: '1000' }, { page: '01' }, { page: '-1' }, { pageSize: '100' }]) assert.throws(() => staffAuditQuery(input), e => e.getStatus() === 400);
  const service = Object.create(StaffReservationsService.prototype), tenantId = randomUUID(); let calls = 0;
  service.db = { $transaction: async (callback, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return callback({ $queryRaw: async (parts, ...values) => {
    const sql = parts.join('?'); calls++;
    assert.ok(values.filter(value => value === tenantId).length >= 2);
    assert.doesNotMatch(sql, /guest|phone|username|reason|token|payload|password|request_hash/i);
    if (calls === 1) { assert.match(sql, /UNION ALL/); assert.match(sql, /created_at DESC, source ASC, id DESC LIMIT 20 OFFSET/); assert.equal(values.at(-1), 20); return []; }
    return [{ total: 21n }];
  } }); } };
  assert.deepEqual(await service.audit(tenantId, { page: '2' }), { data: [], total: 21, page: 2, pageSize: 20 });
});
