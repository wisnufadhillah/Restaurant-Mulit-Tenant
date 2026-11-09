const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');
const { ReservationService } = require('../dist/restaurant/reservation.service');
const { createSessionToken } = require('../dist/auth/crypto');
const { confirmationAllowed } = require('../dist/restaurant/reservation-input');

function boundary() {
  const tenantId = randomUUID(), ownerId = randomUUID();
  const owner = { tenantId, id: ownerId, expiresAt: new Date(Date.now() + 60000), revokedAt: null };
  const draft = () => ({ tenantId, creatorSessionId: ownerId, consumedAt: null, invalidatedAt: null, requestHash: 'a'.repeat(64), expiresAt: owner.expiresAt });
  let state = { reservation: null, drafts: [draft(), { ...draft(), creatorSessionId: randomUUID() }, { ...draft(), tenantId: randomUUID() }, { ...draft(), consumedAt: new Date() }] };
  let fail = false;
  const repository = Object.create(ReservationRepository.prototype);
  repository.db = { async $transaction(run, options) {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    const next = structuredClone(state);
    let locked = false;
    const result = await run({
      tenant: { findFirst: async () => ({ id: tenantId }) },
      $executeRaw: async () => { locked = true; },
      reservationCreatorSession: { findFirst: async ({ where }) => { assert.ok(locked); assert.equal(where.tenantId, tenantId); return owner; } },
      reservation: { findUnique: async ({ where }) => { assert.ok(locked); assert.deepEqual(where.tenantId_idempotencyKey, { tenantId, idempotencyKey: 'synthetic-request-key' }); return next.reservation; } },
      reservationConfirmation: { updateMany: async ({ where, data }) => {
        assert.deepEqual(where, { tenantId, creatorSessionId: ownerId, consumedAt: null, invalidatedAt: null });
        for (const row of next.drafts) if (row.tenantId === tenantId && row.creatorSessionId === ownerId && !row.consumedAt && !row.invalidatedAt) row.invalidatedAt = data.invalidatedAt;
        if (fail) throw new Error('Synthetic recovery failure');
        return { count: 1 };
      } },
    });
    state = next;
    return result;
  } };
  return { repository, owner, state: () => state, fail: () => { fail = true; } };
}

test('recovery commits creator-scoped invalidation and fences delayed nonce without changing consumed or foreign drafts', async () => {
  const b = boundary();
  assert.deepEqual(await b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'), { outcome: 'not_created' });
  const rows = b.state().drafts;
  assert.ok(rows[0].invalidatedAt);
  assert.ok(rows.slice(1).every(row => row.invalidatedAt === null));
  assert.throws(() => confirmationAllowed(b.owner, b.owner.tenantId, 'a'.repeat(64), rows[0], new Date()), e => e.getStatus() === 409);
  assert.deepEqual(await b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'), { outcome: 'not_created' });
  b.state().drafts.push({ ...rows[0], invalidatedAt: null });
  await b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key');
  assert.ok(b.state().drafts.at(-1).invalidatedAt);
});

test('recovery preserves committed booking and drafts; foreign ownership fails closed', async () => {
  const b = boundary();
  b.state().reservation = { creatorSessionId: b.owner.id };
  assert.deepEqual(await b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'), { outcome: 'reservation_exists' });
  assert.equal(b.state().drafts[0].invalidatedAt, null);
  b.state().reservation.creatorSessionId = randomUUID();
  await assert.rejects(b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'), e => e.getStatus() === 403);
  assert.equal(b.state().drafts[0].invalidatedAt, null);
});

test('recovery failure rolls back and rejects expired or revoked creator', async () => {
  const b = boundary();
  b.fail();
  await assert.rejects(b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'));
  assert.equal(b.state().drafts[0].invalidatedAt, null);
  b.owner.revokedAt = new Date();
  await assert.rejects(b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'), e => e.getStatus() === 403);
  b.owner.revokedAt = null; b.owner.expiresAt = new Date(0);
  await assert.rejects(b.repository.recovery('demo-a', 'synthetic-hash', 'synthetic-request-key'), e => e.getStatus() === 403);
});

test('recovery service validates identity and key and sanitizes dependency failure', async () => {
  const service = new ReservationService({ recovery: async () => { throw new Error('Synthetic private failure'); } });
  assert.throws(() => service.recovery('demo-a', undefined, 'synthetic-request-key'), e => e.getStatus() === 403);
  assert.throws(() => service.recovery('demo-a', createSessionToken(), 'short'), e => e.getStatus() === 400);
  await assert.rejects(service.recovery('demo-a', createSessionToken(), 'synthetic-request-key'), e => e.getStatus() === 503 && !e.message.includes('Synthetic'));
});
