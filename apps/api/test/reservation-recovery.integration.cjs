const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');

function repository(db) {
  const result = Object.create(ReservationRepository.prototype);
  result.db = db;
  return result;
}

// Barriers order actual PostgreSQL advisory locks, not simulated timer delays.
async function race(db, first, second) {
  let entered, release, attempted;
  const held = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { attempted = resolve; });
  const wrap = pause => ({ $transaction: (run, options) => db.$transaction(tx => run(new Proxy(tx, {
    get(target, property) {
      if (property === '$executeRaw') return async (...args) => {
        if (!pause) attempted();
        const result = await target.$executeRaw(...args);
        if (pause) { entered(); await gate; }
        return result;
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  })), options) });
  const a = first(repository(wrap(true)));
  // Release waiters on early failure; Promise.allSettled observes both outcomes.
  a.catch(() => entered());
  let b;
  try {
    await held;
    b = second(repository(wrap(false)));
    b.catch(() => attempted());
    await waiting;
  } finally { release(); }
  return Promise.allSettled([a, b]);
}

test('local recovery serializes both create orders, retries lost responses and isolates fixtures', { timeout: 60000 }, async () => {
  assert.equal(process.env.ALLOW_LOCAL_RESERVATION_WRITES, '1', 'Explicit local write approval required');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only approved local database permitted');
  const db = createDatabaseClient();
  const repo = repository(db);
  const tenantIds = [];
  let server;
  try {
    async function fixture() {
      const slug = `recovery-${randomUUID()}`;
      const tenant = await db.tenant.create({ data: { slug, name: 'Synthetic recovery restaurant' } });
      tenantIds.push(tenant.id);
      const outlet = await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic outlet', address: 'Synthetic', contactPhone: '' } });
      await db.diningTable.create({ data: { tenantId: tenant.id, outletId: outlet.id, name: 'Synthetic table', capacity: 4 } });
      await db.weeklyHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId: tenant.id, outletId: outlet.id, weekday, openMinute: 0, closeMinute: 1440 })) });
      const hash = hashSessionToken(createSessionToken());
      const creator = await db.reservationCreatorSession.create({ data: { tenantId: tenant.id, tokenHash: hash, expiresAt: new Date(Date.now() + 86400000) } });
      return { slug, tenantId: tenant.id, hash, creator };
    }
    const a = await fixture(), other = await fixture();
    const secondHash = hashSessionToken(createSessionToken());
    await db.reservationCreatorSession.create({ data: { tenantId: a.tenantId, tokenHash: secondHash, expiresAt: new Date(Date.now() + 86400000) } });
    const body = { date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), time: '10:00', partySize: 4, guestName: 'Tamu Sintetis', guestPhone: '+6281234567890' };
    const foreignDraft = await repo.confirmation(other.slug, other.hash, body);
    const siblingDraft = await repo.confirmation(a.slug, secondHash, body);
    const proposal = await repo.confirmation(a.slug, a.hash, body);
    const key = randomUUID();
    const createFirst = await race(db,
      r => r.create(a.slug, a.hash, body, hashSessionToken(proposal.nonce), key),
      r => r.recovery(a.slug, a.hash, key));
    assert.equal(createFirst[0].status, 'fulfilled');
    assert.equal(createFirst[1].status, 'fulfilled');
    assert.deepEqual(createFirst[1].value, { outcome: 'reservation_exists' });
    assert.equal(await db.reservation.count({ where: { tenantId: a.tenantId, idempotencyKey: key } }), 1);
    assert.equal(await db.reservationEvent.count({ where: { tenantId: a.tenantId } }), 1);
    const consumed = await db.reservationConfirmation.findUniqueOrThrow({ where: { nonceHash: hashSessionToken(proposal.nonce) } });
    assert.ok(consumed.consumedAt);
    assert.equal(consumed.invalidatedAt, null);
    await assert.rejects(repo.recovery(a.slug, secondHash, key), e => e.getStatus() === 403);

    const later = { ...body, time: '13:00' };
    const pending = await repo.confirmation(a.slug, a.hash, later);
    const pendingHash = hashSessionToken(pending.nonce), pendingKey = randomUUID();
    const recoveryFirst = await race(db,
      r => r.recovery(a.slug, a.hash, pendingKey),
      r => r.create(a.slug, a.hash, later, pendingHash, pendingKey));
    assert.equal(recoveryFirst[0].status, 'fulfilled');
    assert.deepEqual(recoveryFirst[0].value, { outcome: 'not_created' });
    assert.equal(recoveryFirst[1].status, 'rejected');
    assert.equal(recoveryFirst[1].reason.getStatus(), 409);
    assert.equal(await db.reservation.count({ where: { tenantId: a.tenantId, idempotencyKey: pendingKey } }), 0);
    await assert.rejects(repo.create(a.slug, a.hash, later, pendingHash, pendingKey), e => e.getStatus() === 409);
    for (const draft of [foreignDraft, siblingDraft]) {
      assert.equal((await db.reservationConfirmation.findUniqueOrThrow({ where: { nonceHash: hashSessionToken(draft.nonce) } })).invalidatedAt, null);
    }
    await assert.rejects(repo.recovery(other.slug, a.hash, randomUUID()), e => e.getStatus() === 403);

    const fresh = await repo.confirmation(a.slug, a.hash, later);
    const freshKey = randomUUID();
    const freshReceipt = await repo.create(a.slug, a.hash, later, hashSessionToken(fresh.nonce), freshKey);
    assert.equal(freshReceipt.status, 'confirmed');
    assert.equal(await db.reservation.count({ where: { tenantId: a.tenantId } }), 2);

    const lostBody = { ...body, time: '16:00' };
    const lostDraft = await repo.confirmation(a.slug, a.hash, lostBody);
    const lostKey = randomUUID();
    let complete;
    const completed = new Promise(resolve => { complete = resolve; });
    server = http.createServer(async (request, response) => {
      try {
        const result = await repo.recovery(a.slug, a.hash, lostKey);
        complete({ result });
        request.socket.destroy();
      } catch (error) { complete({ error }); response.writeHead(500); response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await assert.rejects(fetch(`http://127.0.0.1:${server.address().port}`, { method: 'POST', signal: AbortSignal.timeout(10000) }));
    const observed = await completed;
    assert.equal(observed.error, undefined);
    assert.deepEqual(observed.result, { outcome: 'not_created' });
    const repeated = await Promise.all([repo.recovery(a.slug, a.hash, lostKey), repo.recovery(a.slug, a.hash, lostKey)]);
    assert.ok(repeated.every(value => value.outcome === 'not_created'));
    await assert.rejects(repo.create(a.slug, a.hash, lostBody, hashSessionToken(lostDraft.nonce), lostKey), e => e.getStatus() === 409);
    assert.equal(await db.reservation.count({ where: { tenantId: a.tenantId } }), 2);
    assert.equal(await db.reservationEvent.count({ where: { tenantId: a.tenantId } }), 2);
    assert.equal(await db.reservation.count({ where: { tenantId: other.tenantId } }), 0);
    const preserved = await db.reservationConfirmation.findUniqueOrThrow({ where: { id: consumed.id } });
    assert.deepEqual(preserved.consumedAt, consumed.consumedAt);
    assert.equal(preserved.reservationId, consumed.reservationId);
    assert.equal(preserved.invalidatedAt, null);
  } finally {
    try { if (server) await new Promise(resolve => server.close(resolve)); }
    finally {
      try {
        for (const tenantId of tenantIds) {
          await db.$transaction(async tx => {
            const where = { tenantId };
            await tx.reservationManagementSession.deleteMany({ where });
            await tx.reservationConfirmation.deleteMany({ where });
            await tx.reservationEvent.deleteMany({ where });
            await tx.reservation.deleteMany({ where });
            await tx.reservationCreatorSession.deleteMany({ where });
            await tx.weeklyHours.deleteMany({ where });
            await tx.diningTable.deleteMany({ where });
            await tx.outlet.deleteMany({ where });
            await tx.tenant.deleteMany({ where: { id: tenantId } });
          });
          assert.equal(await db.tenant.count({ where: { id: tenantId } }), 0);
        }
      } finally { await db.$disconnect(); }
    }
  }
});
