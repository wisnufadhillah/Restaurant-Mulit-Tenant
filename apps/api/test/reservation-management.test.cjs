const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');

function boundary() {
  const tenantId = randomUUID(), reservationId = randomUUID();
  const session = { tenantId, reservationId, expiresAt: new Date(Date.now() + 60000), revokedAt: null };
  const row = { tenantId, id: reservationId, outletId: randomUUID(), referenceCode: 'demo-reference', startAt: new Date(Date.now() + 3 * 3600000), endAt: new Date(Date.now() + 4.5 * 3600000), managementExpiresAt: new Date(Date.now() + 86400000), partySize: 4, status: 'confirmed' };
  let events = 0;
  const repository = Object.create(ReservationRepository.prototype);
  repository.db = { $transaction: fn => fn({
    $executeRaw: async () => {}, tenant: { findFirst: async () => ({ id: tenantId }) },
    reservationManagementSession: { findFirst: async args => {
      assert.equal(args.where.tenantId, tenantId);
      return session.revokedAt || session.expiresAt <= args.where.expiresAt.gt ? null : session;
    } },
    outlet: { findFirst: async () => ({ timezone: 'Asia/Jakarta', durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, maxPartySize: 12, cancelCutoffMinutes: 120 }) },
    reservation: { findFirst: async args => {
      assert.deepEqual({ tenantId: args.where.tenantId, id: args.where.id }, { tenantId, id: reservationId });
      return row;
    }, updateMany: async () => { row.status = 'cancelled'; return { count: 1 }; } },
    reservationEvent: { create: async () => { events++; } },
  }) };
  return { repository, session, row, events: () => events };
}

test('management receipt is restricted to session booking and cancellation retries create one event', async () => {
  const b = boundary();
  assert.equal((await b.repository.manage('demo-a', 'synthetic-hash', false)).referenceCode, b.row.referenceCode);
  await assert.rejects(b.repository.manage('demo-a', 'synthetic-hash', true, 'different-tab-reference'), e => e.getStatus() === 409);
  assert.equal(b.row.status, 'confirmed');
  assert.equal(b.events(), 0);
  assert.equal((await b.repository.manage('demo-a', 'synthetic-hash', true, b.row.referenceCode)).status, 'cancelled');
  assert.equal((await b.repository.manage('demo-a', 'synthetic-hash', true, b.row.referenceCode)).status, 'cancelled');
  assert.equal(b.events(), 1);
  b.session.revokedAt = new Date();
  await assert.rejects(b.repository.manage('demo-a', 'synthetic-hash', false), e => e.getStatus() === 403);
});

test('management rejects expired sessions and cancellation inside cutoff', async () => {
  const b = boundary();
  b.session.expiresAt = new Date(0);
  await assert.rejects(b.repository.manage('demo-a', 'synthetic-hash', false), e => e.getStatus() === 403);
  b.session.expiresAt = new Date(Date.now() + 60000);
  b.row.startAt = new Date(Date.now() + 3600000);
  await assert.rejects(b.repository.manage('demo-a', 'synthetic-hash', true, b.row.referenceCode), e => e.getStatus() === 409);
  assert.equal(b.row.status, 'confirmed');
  assert.equal(b.events(), 0);
});
