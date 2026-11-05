const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
require('reflect-metadata');
const { createApp } = require('../dist/create-app');
const { ReservationController } = require('../dist/restaurant/reservation.controller');
const { ReservationService } = require('../dist/restaurant/reservation.service');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { databaseUrl } = require('../dist/database/config');
const { createDatabaseClient } = require('../dist/database/client');

test('local PostgreSQL reservation HTTP isolates tenants and serializes fifty fixed-table attempts', { timeout: 120000 }, async () => {
  if (process.env.ALLOW_LOCAL_RESERVATION_WRITES !== '1') throw new Error('Explicit local reservation write approval is required');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only approved local database permitted');
  const db = createDatabaseClient();
  const tenantIds = [];
  let app;
  try {
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/api/v1/public/tenants`;
    const slugs = [];
    for (let i = 0; i < 2; i++) {
      const slug = `reservation-probe-${randomUUID()}`;
      const tenant = await db.tenant.create({ data: { slug, name: 'Synthetic reservation probe' } });
      tenantIds.push(tenant.id); slugs.push(slug);
      const outlet = await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic outlet', address: 'Synthetic address', contactPhone: '' } });
      await db.diningTable.create({ data: { tenantId: tenant.id, outletId: outlet.id, name: 'Only table', capacity: 4 } });
      await db.weeklyHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId: tenant.id, outletId: outlet.id, weekday, openMinute: 0, closeMinute: 1440 })) });
    }
    const send = (slug, route, body = {}, cookie, key) => fetch(`${root}/${slug}/reservations${route}`, { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(key ? { 'idempotency-key': key } : {}) }, body: JSON.stringify(body) });
    const cookieFrom = response => {
      const raw = response.headers.get('set-cookie');
      assert.ok(raw, 'Expected private cookie');
      return raw.split(';')[0];
    };
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const reservation = { date, time: '12:00', partySize: 4, guestName: 'Tamu Sintetis', guestPhone: '+6281234567890' };
    const attempts = [];
    // Distinct creators prevent proposal replacement from affecting this concurrency test.
    for (let i = 0; i < 50; i++) {
      const token = createSessionToken();
      await db.reservationCreatorSession.create({ data: { tenantId: tenantIds[0], tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 32 * 86400000) } });
      const cookie = `restaurant_reservation_${slugs[0]}=${token}`;
      const proposed = await send(slugs[0], '/confirmations', reservation, cookie);
      assert.equal(proposed.status, 200);
      const { data } = await proposed.json();
      attempts.push({ cookie, nonce: data.nonce, key: randomUUID() });
    }
    const settled = await Promise.allSettled(attempts.map(async attempt => {
      const response = await send(slugs[0], '', { reservation, nonce: attempt.nonce }, attempt.cookie, attempt.key);
      return { attempt, status: response.status, data: await response.json() };
    }));
    assert.equal(settled.filter(r => r.status === 'rejected').length, 0, 'Every parallel request must finish before cleanup');
    const results = settled.map(r => r.value);
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.equal(results.filter(r => r.status === 409).length, 49);
    assert.equal(await db.reservation.count({ where: { tenantId: tenantIds[0], status: 'confirmed' } }), 1);
    assert.equal(await db.reservationEvent.count({ where: { tenantId: tenantIds[0], toStatus: 'confirmed' } }), 1);
    const winner = results.find(r => r.status === 200);
    const { attempt } = winner;
    // Replay after success; this does not simulate a network response lost after commit.
    const replay = await send(slugs[0], '', { reservation, nonce: attempt.nonce }, attempt.cookie, attempt.key);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), winner.data);
    assert.equal((await send(slugs[0], '', { reservation: { ...reservation, partySize: 3 }, nonce: attempt.nonce }, attempt.cookie, attempt.key)).status, 409);
    const foreignCreator = attempts.find(a => a !== attempt);
    assert.equal((await send(slugs[0], '', { reservation, nonce: attempt.nonce }, foreignCreator.cookie, attempt.key)).status, 403);
    assert.equal((await send(slugs[1], '/management-session', {}, attempt.cookie, attempt.key)).status, 403);
    const issue = await send(slugs[0], '/management-session', {}, attempt.cookie, attempt.key);
    assert.equal(issue.status, 200);
    const managedCookie = cookieFrom(issue);
    const receipt = await send(slugs[0], '/receipt', {}, managedCookie);
    assert.equal(receipt.status, 200);
    assert.deepEqual(await receipt.json(), winner.data);
    const otherSession = await send(slugs[1], '/session');
    const otherCookie = cookieFrom(otherSession);
    const otherProposal = await send(slugs[1], '/confirmations', reservation, otherCookie);
    assert.equal(otherProposal.status, 200);
    const otherNonce = (await otherProposal.json()).data.nonce;
    assert.equal((await send(slugs[1], '', { reservation, nonce: otherNonce }, otherCookie, randomUUID())).status, 200);
    assert.equal((await send(slugs[0], '/cancel', { referenceCode: 'wrong-displayed-booking' }, managedCookie)).status, 409);
    assert.equal((await send(slugs[0], '/cancel', { referenceCode: winner.data.data.referenceCode }, managedCookie)).status, 200);
    assert.equal((await send(slugs[0], '/cancel', { referenceCode: winner.data.data.referenceCode }, managedCookie)).status, 200);
    assert.equal(await db.reservationEvent.count({ where: { tenantId: tenantIds[0], toStatus: 'cancelled' } }), 1);
    assert.equal((await send(slugs[0], '/management-session/logout', {}, managedCookie)).status, 204);
    assert.equal((await send(slugs[0], '/receipt', {}, managedCookie)).status, 403);
  } finally {
    // Stop HTTP before removing fixtures. All parallel requests were settled above.
    try { if (app) await app.close(); } finally {
    // Never clean by prefix: only exact tenant IDs created by this invocation.
    const where = { tenantId: { in: tenantIds } };
    try {
      if (tenantIds.length) await db.$transaction(async tx => {
        await tx.reservationManagementSession.deleteMany({ where });
        await tx.reservationConfirmation.deleteMany({ where });
        await tx.reservationEvent.deleteMany({ where });
        await tx.reservation.deleteMany({ where });
        await tx.reservationCreatorSession.deleteMany({ where });
        await tx.weeklyHours.deleteMany({ where });
        await tx.diningTable.deleteMany({ where });
        await tx.outlet.deleteMany({ where });
        await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      });
      assert.equal(await db.tenant.count({ where: { id: { in: tenantIds } } }), 0);
    } finally { await db.$disconnect(); }
    }
  }
});
