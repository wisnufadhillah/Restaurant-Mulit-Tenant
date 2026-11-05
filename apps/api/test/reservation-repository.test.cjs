const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');
const { reservationRequestHash } = require('../dist/restaurant/reservation-input');

const tenantId = randomUUID(), outletId = randomUUID(), ownerId = randomUUID(), tableId = randomUUID();
const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const body = { date, time: '12:00', partySize: 4, guestName: 'Tamu Demo', guestPhone: '+6281234567890' };
const requestHash = reservationRequestHash(tenantId, outletId, body);

function boundary(failure) {
  const repository = Object.create(ReservationRepository.prototype);
  let state = { bookings: [], events: [], consumed: false };
  const owner = { id: ownerId, tenantId, expiresAt: new Date(Date.now() + 86400000), revokedAt: null };
  repository.db = { async $transaction(fn, options) {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    const next = structuredClone(state);
    let locked = false;
    const scoped = args => { assert.equal(locked, true); assert.equal(args.where.tenantId, tenantId); };
    const tx = {
      $executeRaw: async () => { locked = true; },
      tenant: { findFirst: async () => ({ id: tenantId }) },
      reservationCreatorSession: { findFirst: async args => { scoped(args); return owner; } },
      outlet: { findMany: async args => { scoped(args); return [{ id: outletId, timezone: 'Asia/Jakarta', durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, maxPartySize: 12, cancelCutoffMinutes: 120 }]; } },
      weeklyHours: { findMany: async args => { scoped(args); return [{ weekday: new Date(date).getUTCDay(), openMinute: 0, closeMinute: 1440 }]; } },
      specialHours: { findMany: async args => { scoped(args); return []; } },
      diningTable: { findMany: async args => { scoped(args); return [{ id: tableId, capacity: 4, isActive: true }]; } },
      reservation: {
        findUnique: async args => { assert.equal(args.where.tenantId_idempotencyKey.tenantId, tenantId); return next.bookings[0] ?? null; },
        findMany: async args => { scoped(args); return next.bookings; },
        create: async ({ data }) => { const row = { id: randomUUID(), ...data }; next.bookings.push(row); return row; },
      },
      reservationEvent: { create: async ({ data }) => { if (failure === 'event') throw new Error('Synthetic event failure'); next.events.push(data); } },
      reservationConfirmation: {
        findFirst: async args => { scoped(args); return { id: randomUUID(), tenantId, creatorSessionId: ownerId, requestHash, expiresAt: new Date(Date.now() + 60000), consumedAt: next.consumed ? new Date() : null, invalidatedAt: null }; },
        updateMany: async () => { if (failure === 'consume') return { count: 0 }; next.consumed = true; return { count: 1 }; },
      },
    };
    const result = await fn(tx);
    state = next;
    return result;
  } };
  return { repository, owner, state: () => state };
}

test('reservation create returns same receipt on retry and commits one booking and event', async () => {
  const b = boundary();
  const first = await b.repository.create('demo-a', 'synthetic-hash', body, 'synthetic-nonce-hash', 'synthetic-request-key');
  const second = await b.repository.create('demo-a', 'synthetic-hash', body, 'different-nonce-hash', 'synthetic-request-key');
  assert.deepEqual(second, first);
  assert.equal(first.status, 'confirmed');
  assert.deepEqual(Object.keys(first).sort(), ['endAt', 'partySize', 'referenceCode', 'startAt', 'status', 'timezone']);
  assert.equal(b.state().bookings.length, 1);
  assert.equal(b.state().events.length, 1);
  assert.equal(b.state().consumed, true);
  await assert.rejects(b.repository.create('demo-a', 'synthetic-hash', { ...body, partySize: 3 }, 'synthetic-nonce-hash', 'synthetic-request-key'), e => e.getStatus() === 409);
  b.owner.revokedAt = new Date();
  await assert.rejects(b.repository.create('demo-a', 'synthetic-hash', body, 'synthetic-nonce-hash', 'synthetic-request-key'), e => e.getStatus() === 403);
});

test('database boundary rolls back partial create when event or confirmation consumption fails', async () => {
  for (const failure of ['event', 'consume']) {
    const b = boundary(failure);
    await assert.rejects(b.repository.create('demo-a', 'synthetic-hash', body, 'synthetic-nonce-hash', 'synthetic-request-key'));
    assert.deepEqual(b.state(), { bookings: [], events: [], consumed: false });
  }
});
