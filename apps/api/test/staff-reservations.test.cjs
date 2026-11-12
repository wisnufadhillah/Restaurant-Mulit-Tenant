const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StaffReservationsService, staffReservationQuery, staffTransitionInput, staffTransitionAllowed, staffAuditQuery } = require('../dist/restaurant/staff-reservations.service');

test('staff transitions require exact bodies, normalized reasons and explicit attendance review', () => {
  assert.deepEqual(staffTransitionInput({ status: 'cancelled', reason: '  Private reason  ' }), { status: 'cancelled', reason: 'Private reason' });
  assert.equal(staffTransitionInput({ status: 'completed' }).reason, null);
  assert.equal(staffTransitionInput({ status: 'no_show', reviewed: true }).status, 'no_show');
  for (const body of [null, [], { status: 'confirmed' }, { status: 'cancelled', reason: ' ' }, { status: 'cancelled', reason: 'x'.repeat(501) }, { status: 'cancelled', reason: 'a\nb' }, { status: 'completed', reason: 'x' }, { status: 'completed', tenantId: 'foreign' }, { status: 'no_show' }, { status: 'no_show', reviewed: false }]) assert.throws(() => staffTransitionInput(body), e => e.getStatus() === 400);
});
test('staff terminal transitions reject exact end boundary and permit staff cancellation without customer cutoff', () => {
  const end = new Date('2026-01-01T01:00:00Z');
  for (const status of ['completed', 'no_show']) {
    for (const offset of [-1, 0]) assert.throws(() => staffTransitionAllowed('confirmed', end, status, new Date(+end + offset)), e => e.getStatus() === 409);
    assert.doesNotThrow(() => staffTransitionAllowed('confirmed', end, status, new Date(+end + 1)));
  }
  assert.doesNotThrow(() => staffTransitionAllowed('confirmed', end, 'cancelled', new Date(+end - 1)));
  for (const status of ['cancelled', 'completed', 'no_show']) assert.throws(() => staffTransitionAllowed(status, end, 'cancelled', new Date(+end + 1)), e => e.getStatus() === 409);
});
test('staff reservation filters enforce strict calendar, status and pagination', () => {
  const value = staffReservationQuery({ date: '2026-11-07', status: 'confirmed', page: '2' });
  assert.equal(value.startAt.gte.toISOString(), '2026-11-06T17:00:00.000Z');
  assert.equal(value.startAt.lt.toISOString(), '2026-11-07T17:00:00.000Z');
  assert.equal(value.page, 2);
  for (const input of [{ tenantId: 'other' }, { date: '2026-02-30' }, { date: ['2026-11-07'] }, { status: 'pending' }, { page: '01' }, { page: '0' }, { page: '1e2' }]) assert.throws(() => staffReservationQuery(input), e => e.getStatus() === 400);
});
test('staff reservation list scopes rows and count while excluding private contact and credentials', async () => {
  const service = Object.create(StaffReservationsService.prototype);
  service.db = { $transaction: (fn, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return fn({ reservation: { findMany: async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.take, 20); assert.equal(args.skip, 20); for (const field of ['guestPhone', 'managementTokenHash', 'requestHash', 'idempotencyKey']) assert.equal(args.select[field], undefined); return []; }, count: async args => { assert.equal(args.where.tenantId, 'tenant-a'); return 0; } } }); } };
  assert.deepEqual(await service.list('tenant-a', { page: '2' }), { data: [], page: 2, pageSize: 20, total: 0 });
});
test('staff reservation detail hides foreign and missing IDs behind not found', async () => {
  const service = Object.create(StaffReservationsService.prototype);
  service.db = { reservation: { findFirst: async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.select.guestPhone, true); assert.equal(args.select.managementTokenHash, undefined); return null; } } };
  await assert.rejects(service.detail('tenant-a', '11111111-1111-4111-8111-111111111111'), e => e.getStatus() === 404);
});
