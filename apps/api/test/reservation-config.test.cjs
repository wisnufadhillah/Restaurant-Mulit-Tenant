const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reservationFitsHours, protectReservationSchedule } = require('../dist/restaurant/reservation-config');

test('schedule edits preserve entire Jakarta booking interval including midnight', () => {
  const booking = { startAt: new Date('2026-11-10T14:30Z'), endAt: new Date('2026-11-10T16:00Z') };
  assert.equal(reservationFitsHours(booking, { openMinute: 1200, closeMinute: 1380 }), true);
  assert.equal(reservationFitsHours(booking, { openMinute: null, closeMinute: null }), false);
  assert.equal(reservationFitsHours(booking, { openMinute: 1291, closeMinute: 1440 }), false);
  assert.equal(reservationFitsHours(booking, { openMinute: 0, closeMinute: 1379 }), false);
  assert.equal(reservationFitsHours({ startAt: new Date('2026-11-10T15:30Z'), endAt: new Date('2026-11-10T17:00Z') }, { openMinute: 0, closeMinute: 1440 }), true);
});

test('schedule protection respects special overrides and refuses destructive fallback hours', async () => {
  const row = { startAt: new Date('2026-11-10T03:00Z'), endAt: new Date('2026-11-10T04:30Z') };
  let special = { openMinute: 600, closeMinute: 1200 };
  const tx = {
    reservation: { findMany: async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.outletId, 'outlet-a'); assert.equal(args.where.status, 'confirmed'); return [row]; } },
    specialHours: { findUnique: async () => special },
    weeklyHours: { findUnique: async () => ({ openMinute: null, closeMinute: null }) },
  };
  await protectReservationSchedule(tx, 'tenant-a', 'outlet-a', { weekday: 2, hours: { openMinute: null, closeMinute: null } });
  special = null;
  await assert.rejects(protectReservationSchedule(tx, 'tenant-a', 'outlet-a', { weekday: 2, hours: { openMinute: null, closeMinute: null } }), e => e.getStatus() === 409);
  await assert.rejects(protectReservationSchedule(tx, 'tenant-a', 'outlet-a', { date: new Date('2026-11-10T00:00Z'), hours: null }), e => e.getStatus() === 409);
});
