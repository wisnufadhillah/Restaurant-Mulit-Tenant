const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reservationInput, reservationRequestHash, confirmationAllowed, replayReservation } = require('../dist/restaurant/reservation-input');
const input = () => ({ date: '2026-11-09', time: '12:30', partySize: 4, guestName: '  Tamu   Demo ', guestPhone: '0812-3456-7890' });
const tenantId = '11111111-1111-4111-8111-111111111111';
const outletId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-11-10T00:00:00Z');
const owner = () => ({ tenantId, id: sessionId, expiresAt: new Date('2026-11-11T00:00:00Z'), revokedAt: null });

test('reservation input produces canonical private details without current availability checks', () => {
  assert.deepEqual(reservationInput(input()), { date: '2026-11-09', time: '12:30', partySize: 4, guestName: 'Tamu Demo', guestPhone: '+6281234567890' });
  assert.deepEqual(reservationInput({ ...input(), guestPhone: '+62 812 3456 7890' }), reservationInput(input()));
});

test('private input rejects impossible dates, authority fields, malformed contacts and controls', () => {
  for (const body of [null, [], { ...input(), confirmed: true }, { ...input(), tenantId }, { ...input(), date: '2026-02-30' }, { ...input(), time: '24:00' }, { ...input(), partySize: 1.5 }, { ...input(), guestName: 'Demo\u0000' }, { ...input(), guestName: ' ' }, { ...input(), guestPhone: '+62+81234567890' }]) {
    assert.throws(() => reservationInput(body), e => e.getStatus() === 400);
  }
});

test('request hash is canonical and scoped to customer details and server outlet', () => {
  const hash = reservationRequestHash(tenantId, outletId, input());
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, reservationRequestHash(tenantId, outletId, { ...input(), guestPhone: '+6281234567890', guestName: 'Tamu Demo' }));
  for (const change of [{ date: '2026-11-10' }, { time: '12:31' }, { partySize: 3 }, { guestName: 'Tamu Lain' }, { guestPhone: '+6281234567891' }]) {
    assert.notEqual(hash, reservationRequestHash(tenantId, outletId, { ...input(), ...change }));
  }
  assert.notEqual(hash, reservationRequestHash(outletId, tenantId, input()));
});

test('receipt replay authenticates owner and hash without rejecting past booking time', () => {
  const hash = reservationRequestHash(tenantId, outletId, input());
  const stored = { tenantId, creatorSessionId: sessionId, requestHash: hash, referenceCode: 'demo-receipt' };
  assert.equal(replayReservation(owner(), tenantId, hash, stored, now), stored);
  assert.equal(replayReservation(owner(), tenantId, hash, null, now), null);
  assert.throws(() => replayReservation(owner(), tenantId, '0'.repeat(64), stored, now), e => e.getStatus() === 409);
  for (const other of [{ ...owner(), id: outletId }, { ...owner(), tenantId: outletId }, { ...owner(), revokedAt: now }, { ...owner(), expiresAt: now }]) {
    assert.throws(() => replayReservation(other, tenantId, hash, stored, now), e => e.getStatus() === 403);
  }
});

test('fresh confirmation requires owner, unchanged payload, live expiry and unused proposal', () => {
  const hash = reservationRequestHash(tenantId, outletId, input());
  const confirmation = { tenantId, creatorSessionId: sessionId, requestHash: hash, expiresAt: new Date(now.getTime() + 1), consumedAt: null, invalidatedAt: null };
  assert.equal(confirmationAllowed(owner(), tenantId, hash, confirmation, now), undefined);
  for (const change of [{ requestHash: '0'.repeat(64) }, { expiresAt: now }, { consumedAt: now }, { invalidatedAt: now }]) {
    assert.throws(() => confirmationAllowed(owner(), tenantId, hash, { ...confirmation, ...change }, now), e => e.getStatus() === 409);
  }
  assert.throws(() => confirmationAllowed(owner(), tenantId, hash, { ...confirmation, creatorSessionId: outletId }, now), e => e.getStatus() === 403);
});
