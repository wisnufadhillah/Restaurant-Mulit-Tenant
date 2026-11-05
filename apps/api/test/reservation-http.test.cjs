const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
const { Module, ForbiddenException } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ReservationController } = require('../dist/restaurant/reservation.controller');
const { ReservationService } = require('../dist/restaurant/reservation.service');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ApiErrorFilter } = require('../dist/http/error.filter');

test('reservation HTTP protects private routes, cookie scope and error responses', async () => {
  const creator = createSessionToken(), management = createSessionToken(), nonce = createSessionToken();
  let mode = 'normal', writes = 0;
  const receipt = { referenceCode: randomUUID(), startAt: '2026-11-15T05:00:00.000Z', endAt: '2026-11-15T06:30:00.000Z', partySize: 4, timezone: 'Asia/Jakarta', status: 'confirmed' };
  const expiresAt = new Date(Date.now() + 60000).toISOString();
  const repository = {
    async session(slug, hash) {
      if (mode === 'failure') throw new Error('Synthetic dependency failure');
      if (hash && hash !== hashSessionToken(creator)) throw new ForbiddenException();
      return { ...(hash ? {} : { token: creator }), expiresAt };
    },
    async confirmation(slug, hash) {
      if (slug !== 'demo-a' || hash !== hashSessionToken(creator)) throw new ForbiddenException();
      return { nonce, expiresAt, summary: { held: false } };
    },
    async create(slug, hash) { if (slug !== 'demo-a' || hash !== hashSessionToken(creator)) throw new ForbiddenException(); writes++; return receipt; },
    async managementSession(slug, hash) { if (slug !== 'demo-a' || hash !== hashSessionToken(creator)) throw new ForbiddenException(); return { token: management, expiresAt }; },
    async manage(slug, hash, cancel) {
      if (slug !== 'demo-a' || hash !== hashSessionToken(management)) throw new ForbiddenException();
      return { ...receipt, status: cancel ? 'cancelled' : receipt.status };
    },
    async revokeManagement(slug, hash) { if (hash !== hashSessionToken(management)) throw new ForbiddenException(); },
  };
  class TestModule {}
  Module({ controllers: [ReservationController], providers: [ReservationService, { provide: ReservationRepository, useValue: repository }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ApiErrorFilter());
  try {
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/api/v1/public/tenants`;
    const cookie = `restaurant_reservation_demo-a=${creator}`;
    const managedCookie = `restaurant_reservation_demo-a_management=${management}`;
    const send = (route, body = {}, headers = {}, slug = 'demo-a') => fetch(`${root}/${slug}/reservations${route}`, { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const session = await send('/session');
    assert.equal(session.status, 200);
    assert.equal(session.headers.get('cache-control'), 'no-store');
    assert.match(session.headers.get('set-cookie'), /Path=\/api\/v1\/public\/tenants\/demo-a\/reservations; HttpOnly; SameSite=Strict/);
    assert.deepEqual(await session.json(), { data: { expiresAt } });
    const reused = await send('/session', {}, { cookie });
    assert.equal(reused.headers.get('set-cookie'), null);
    for (const origin of ['', 'null', 'https://foreign.invalid']) assert.equal((await send('/session', {}, { origin })).status, 403);
    assert.equal((await send('/session', {}, { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await send('/session', {}, { 'content-type': 'text/plain' })).status, 403);
    assert.equal((await send('/session', {}, { cookie: `${cookie}; ${cookie}` })).status, 403);
    const reservation = { date: '2026-11-15', time: '12:00', partySize: 4, guestName: 'Tamu Demo', guestPhone: '081234567890' };
    assert.equal((await send('/confirmations', reservation)).status, 403);
    assert.equal((await send('/confirmations', { ...reservation, tenantId: 'other' }, { cookie })).status, 400);
    assert.equal((await send('/confirmations', reservation, { cookie })).status, 200);
    assert.equal((await send('', { reservation, nonce, confirmed: true }, { cookie, 'idempotency-key': randomUUID() })).status, 400);
    assert.equal(writes, 0);
    assert.equal((await send('', { reservation, nonce }, { cookie, 'idempotency-key': randomUUID() })).status, 200);
    assert.equal((await send('/management-session', {}, { cookie, 'idempotency-key': randomUUID() })).status, 200);
    assert.equal((await send('/receipt', {}, { cookie })).status, 403);
    const read = await send('/receipt', {}, { cookie: managedCookie });
    assert.equal(read.status, 200);
    assert.deepEqual(await read.json(), { data: receipt });
    assert.equal((await send('/receipt', { referenceCode: receipt.referenceCode }, { cookie: managedCookie })).status, 403);
    assert.equal((await send('/receipt', {}, { cookie: managedCookie }, 'demo-b')).status, 403);
    assert.equal((await send('/cancel', { referenceCode: receipt.referenceCode }, { cookie: managedCookie })).status, 200);
    const logout = await send('/management-session/logout', {}, { cookie: managedCookie });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    mode = 'failure';
    const failed = await send('/session');
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
    assert.equal(JSON.stringify(await failed.json()).includes('Synthetic dependency'), false);
    mode = 'normal';
    for (let i = 0; i < 20; i++) await send('/session', {}, { 'x-forwarded-for': `192.0.2.${i}` });
    const throttled = await send('/session', {}, { 'x-forwarded-for': '198.51.100.1' });
    assert.equal(throttled.status, 429);
    assert.ok(Number(throttled.headers.get('retry-after')) > 0);
    assert.equal(throttled.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await throttled.json()).error, { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan.' });
  } finally { await app.close(); }
});
