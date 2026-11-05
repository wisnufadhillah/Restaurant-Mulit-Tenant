const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AvailabilityRepository } = require('../dist/restaurant/availability.repository');
const policy = { timezone: 'Asia/Jakarta', durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, maxPartySize: 12, cancelCutoffMinutes: 120 };
const input = { date: '2026-11-02', time: '10:00', partySize: 4 };
const now = new Date('2026-11-02T02:00:00Z');

function boundary(mode = 'normal') {
  const repository = Object.create(AvailabilityRepository.prototype);
  const queries = [];
  const scoped = (name, rows) => ({ async findMany(args) {
    queries.push([name, args]);
    assert.equal(args.where.tenantId, 'tenant-a');
    assert.equal(args.where.outletId, 'outlet-a');
    assert.equal(args.take, undefined);
    return rows;
  } });
  const tx = {
    tenant: { async findFirst(args) { assert.deepEqual(args, { where: { slug: 'demo-a', status: 'active' }, select: { id: true } }); return mode === 'missing' ? null : { id: 'tenant-a' }; } },
    outlet: { async findMany(args) {
      assert.deepEqual(args.where, { tenantId: 'tenant-a', isActive: true });
      assert.equal(args.take, 2);
      return mode === 'no-outlet' ? [] : Array.from({ length: mode === 'ambiguous' ? 2 : 1 }, () => ({ id: 'outlet-a', ...policy }));
    } },
    weeklyHours: scoped('weekly', [{ weekday: 1, openMinute: 600, closeMinute: 1320 }]),
    specialHours: scoped('special', [{ date: new Date('2026-11-02T00:00Z'), openMinute: null, closeMinute: null }]),
    diningTable: scoped('tables', [{ id: 'table-a', capacity: 4, isActive: true }]),
    reservation: scoped('reservations', []),
  };
  repository.db = { async $transaction(callback, options) {
    assert.deepEqual(options, { isolationLevel: 'RepeatableRead', maxWait: 2000, timeout: 5000 });
    if (mode === 'failure') throw new Error('Synthetic unavailable');
    return callback(tx);
  } };
  return { repository, queries };
}

test('availability snapshot scopes every database query and reads only overlapping confirmed intervals', async () => {
  const { repository, queries } = boundary();
  const snapshot = await repository.snapshot('demo-a', input, now);
  assert.equal(snapshot.specialHours[0].date, '2026-11-02');
  const byName = Object.fromEntries(queries);
  assert.equal(byName.weekly.where.weekday, 1);
  assert.equal(byName.special.where.date.toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(byName.tables.where.isActive, true);
  assert.deepEqual(byName.reservations.where, { tenantId: 'tenant-a', outletId: 'outlet-a', status: 'confirmed', startAt: { lt: new Date('2026-11-02T04:30Z') }, endAt: { gt: new Date('2026-11-02T03:00Z') } });
  assert.deepEqual(byName.reservations.select, { tableId: true, startAt: true, endAt: true, status: true });
  assert.equal(snapshot.policy.timezone, 'Asia/Jakarta');
});

test('availability snapshot rejects missing or ambiguous catalogue scope instead of choosing a default outlet', async () => {
  for (const [mode, status] of [['missing', 404], ['no-outlet', 404], ['ambiguous', 409]]) {
    const { repository } = boundary(mode);
    await assert.rejects(repository.snapshot('demo-a', input, now), error => error.getStatus() === status);
  }
});
