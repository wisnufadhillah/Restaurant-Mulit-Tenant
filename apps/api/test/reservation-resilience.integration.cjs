const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');
const { TableService } = require('../dist/restaurant/table.service');
const { HoursService } = require('../dist/restaurant/hours.service');

// Faults are injected only at the database boundary; SQL operations use real PostgreSQL transactions.
test('local reservations roll back audit failure, preserve configuration and recover a lost HTTP response', { timeout: 60000 }, async () => {
  assert.equal(process.env.ALLOW_LOCAL_RESERVATION_WRITES, '1', 'Explicit local write approval required');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only approved local database permitted');
  const db = createDatabaseClient();
  const repo = Object.create(ReservationRepository.prototype);
  repo.db = db;
  const tables = Object.create(TableService.prototype); tables.db = db;
  const hours = Object.create(HoursService.prototype); hours.db = db;
  let tenantId, server;
  try {
    const slug = `resilience-${randomUUID()}`;
    const tenant = await db.tenant.create({ data: { slug, name: 'Synthetic resilience restaurant' } }); tenantId = tenant.id;
    const outlet = await db.outlet.create({ data: { tenantId, name: 'Synthetic outlet', address: 'Synthetic', contactPhone: '' } });
    const table = await db.diningTable.create({ data: { tenantId, outletId: outlet.id, name: 'Only table', capacity: 4 } });
    await db.weeklyHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId, outletId: outlet.id, weekday, openMinute: 0, closeMinute: 1440 })) });
    const token = createSessionToken(), tokenHash = hashSessionToken(token);
    await db.reservationCreatorSession.create({ data: { tenantId, tokenHash, expiresAt: new Date(Date.now() + 86400000) } });
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const input = { date, time: '12:00', partySize: 4, guestName: 'Tamu Sintetis', guestPhone: '+6281234567890' };
    const proposal = await repo.confirmation(slug, tokenHash, input);
    const nonceHash = hashSessionToken(proposal.nonce), key = randomUUID();
    let auditFaultReached = false;
    const faulty = Object.create(ReservationRepository.prototype);
    faulty.db = { $transaction: (callback, options) => db.$transaction(tx => callback(new Proxy(tx, {
      get(target, property) {
        if (property === 'reservationEvent') return { create: async () => { auditFaultReached = true; throw new Error('Synthetic audit failure'); } };
        return Reflect.get(target, property);
      },
    })), options) };
    await assert.rejects(faulty.create(slug, tokenHash, input, nonceHash, key), { message: 'Synthetic audit failure' });
    assert.equal(auditFaultReached, true);
    assert.equal(await db.reservation.count({ where: { tenantId } }), 0);
    assert.equal(await db.reservationEvent.count({ where: { tenantId } }), 0);
    const unchanged = await db.reservationConfirmation.findUniqueOrThrow({ where: { nonceHash } });
    assert.equal(unchanged.consumedAt, null);
    assert.equal(unchanged.reservationId, null);

    // Destroy the socket only AFTER create returned from the real transaction commit.
    let committed;
    const commitObserved = new Promise(resolve => { committed = resolve; });
    let serverError;
    server = http.createServer(async (request, response) => {
      try {
        await repo.create(slug, tokenHash, input, nonceHash, key);
        committed();
        request.socket.destroy();
      } catch (error) { serverError = error; committed(); response.writeHead(500); response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await assert.rejects(fetch(`http://127.0.0.1:${server.address().port}`, { method: 'POST', signal: AbortSignal.timeout(10000) }));
    await commitObserved;
    assert.equal(serverError, undefined);
    const replay = await repo.create(slug, tokenHash, input, nonceHash, key);
    const stored = await db.reservation.findFirstOrThrow({ where: { tenantId, idempotencyKey: key } });
    assert.equal(replay.referenceCode, stored.referenceCode);
    assert.equal(await db.reservation.count({ where: { tenantId } }), 1);
    assert.equal(await db.reservationEvent.count({ where: { tenantId } }), 1);

    // Existing booking wins: destructive config edits must be rejected, not cancel it.
    await assert.rejects(tables.save(tenantId, { name: 'Only table', capacity: 2, isActive: true }, table.id), e => e.getStatus() === 409);
    await assert.rejects(hours.save(tenantId, { weekday: new Date(date).getUTCDay(), openMinute: null, closeMinute: null }), e => e.getStatus() === 409);
    const savedHours = await db.weeklyHours.findUniqueOrThrow({ where: { tenantId_outletId_weekday: { tenantId, outletId: outlet.id, weekday: new Date(date).getUTCDay() } } });
    assert.equal(savedHours.openMinute, 0);
    assert.equal(savedHours.closeMinute, 1440);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).capacity, 4);
    assert.equal((await db.reservation.findUniqueOrThrow({ where: { id: stored.id } })).status, 'confirmed');

    // Config wins: a stale proposal cannot create after table deactivation commits.
    const secondInput = { ...input, time: '15:00' };
    const second = await repo.confirmation(slug, tokenHash, secondInput);
    await db.reservation.update({ where: { id: stored.id }, data: { status: 'cancelled' } });
    await tables.save(tenantId, { name: 'Only table', capacity: 4, isActive: false }, table.id);
    await assert.rejects(repo.create(slug, tokenHash, secondInput, hashSessionToken(second.nonce), randomUUID()), e => e.getStatus() === 409);
    assert.equal(await db.reservation.count({ where: { tenantId, status: 'confirmed' } }), 0);

    await tables.save(tenantId, { name: 'Only table', capacity: 4, isActive: true }, table.id);
    // Pause the actual first writer after acquiring its SQL advisory lock.
    async function race(first, secondWriter) {
      let entered, release, secondEntered;
      const held = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const attempted = new Promise(resolve => { secondEntered = resolve; });
      const wrapped = pause => ({ $transaction: (callback, options) => db.$transaction(tx => callback(new Proxy(tx, {
        get(target, property) {
          if (property === '$executeRaw') return async (...args) => {
            if (!pause) secondEntered();
            const result = await target.$executeRaw(...args);
            if (pause) { entered(); await gate; }
            return result;
          };
          const value = Reflect.get(target, property);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      })), options) });
      const a = first(wrapped(true));
      let b;
      try { await held; b = secondWriter(wrapped(false)); await attempted; }
      finally { release(); }
      return Promise.allSettled([a, b]);
    }
    const raceBody = { ...input, time: '17:00' };
    const raceProposal = await repo.confirmation(slug, tokenHash, raceBody);
    const bookingFirst = await race(
      client => { const r = Object.create(ReservationRepository.prototype); r.db = client; return r.create(slug, tokenHash, raceBody, hashSessionToken(raceProposal.nonce), randomUUID()); },
      client => { const t = Object.create(TableService.prototype); t.db = client; return t.save(tenantId, { name: 'Only table', capacity: 2, isActive: true }, table.id); },
    );
    assert.equal(bookingFirst[0].status, 'fulfilled');
    assert.equal(bookingFirst[1].status, 'rejected');
    assert.equal(bookingFirst[1].reason.getStatus(), 409);
    const laterBody = { ...input, time: '20:00' };
    const laterProposal = await repo.confirmation(slug, tokenHash, laterBody);
    const configFirst = await race(
      client => { const h = Object.create(HoursService.prototype); h.db = client; return h.save(tenantId, { weekday: new Date(date).getUTCDay(), openMinute: 0, closeMinute: 1140 }); },
      client => { const r = Object.create(ReservationRepository.prototype); r.db = client; return r.create(slug, tokenHash, laterBody, hashSessionToken(laterProposal.nonce), randomUUID()); },
    );
    assert.equal(configFirst[0].status, 'fulfilled');
    assert.equal(configFirst[1].status, 'rejected');
    assert.equal(configFirst[1].reason.getStatus(), 409);

    // Expiry fixtures remain valid SQL rows but are already expired at invocation.
    const expiresBody = { ...input, time: '10:00' };
    const expiresProposal = await repo.confirmation(slug, tokenHash, expiresBody);
    const expiredHash = hashSessionToken(expiresProposal.nonce);
    await db.reservationConfirmation.update({ where: { nonceHash: expiredHash }, data: { createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1) } });
    const before = await db.reservation.count({ where: { tenantId } });
    await assert.rejects(repo.create(slug, tokenHash, expiresBody, expiredHash, randomUUID()), e => e.getStatus() === 409);
    await db.reservationCreatorSession.update({ where: { tokenHash }, data: { createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1) } });
    await assert.rejects(repo.create(slug, tokenHash, expiresBody, expiredHash, randomUUID()), e => e.getStatus() === 403);
    assert.equal(await db.reservation.count({ where: { tenantId } }), before);
    assert.equal((await db.reservationConfirmation.findUniqueOrThrow({ where: { nonceHash: expiredHash } })).consumedAt, null);
  } finally {
    try { if (server) await new Promise(resolve => server.close(resolve)); } finally {
      try {
        if (tenantId) await db.$transaction(async tx => {
          const where = { tenantId };
          await tx.reservationManagementSession.deleteMany({ where });
          await tx.reservationConfirmation.deleteMany({ where });
          await tx.reservationEvent.deleteMany({ where });
          await tx.reservation.deleteMany({ where });
          await tx.reservationCreatorSession.deleteMany({ where });
          await tx.operationalAudit.deleteMany({ where });
          await tx.weeklyHours.deleteMany({ where });
          await tx.diningTable.deleteMany({ where });
          await tx.outlet.deleteMany({ where });
          await tx.tenant.deleteMany({ where: { id: tenantId } });
        });
      } finally { await db.$disconnect(); }
    }
  }
});
