const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { StaffReservationsController } = require('../dist/restaurant/staff-reservations.controller');
const { StaffReservationsService } = require('../dist/restaurant/staff-reservations.service');
const { StaffService } = require('../dist/auth/staff.service');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ApiErrorFilter } = require('../dist/http/error.filter');

test('staff reservation HTTP authenticates role and tenant, validates filters and minimizes data', async () => {
  const token = createSessionToken(), tenantId = randomUUID(), staffId = randomUUID(), reservationId = randomUUID();
  let reads = 0, dependencyFailure = false;
  const session = { tenantId, staffId, expiresAt: new Date(Date.now() + 60000), revokedAt: null, staff: { id: staffId, tenantId, username: 'synthetic.staff', role: 'owner', isActive: true, tenant: { slug: 'demo-a', status: 'active' } } };
  const accounts = { session: async hash => hash === hashSessionToken(token) ? session : null };
  const reservations = Object.create(StaffReservationsService.prototype);
  const row = { id: reservationId, referenceCode: 'synthetic-booking', guestName: 'Synthetic Guest', partySize: 4, startAt: new Date('2026-11-10T03:00Z'), endAt: new Date('2026-11-10T04:30Z'), status: 'confirmed', table: { name: 'Synthetic table' }, outlet: { name: 'Synthetic outlet' } };
  const db = { reservation: {
    findMany: async args => { reads++; assert.equal(args.where.tenantId, tenantId); if (dependencyFailure) throw new Error('Synthetic DB failure'); return [row]; },
    count: async args => { assert.equal(args.where.tenantId, tenantId); return 1; },
    findFirst: async args => { reads++; assert.equal(args.where.tenantId, tenantId); return args.where.id === reservationId ? { ...row, guestPhone: '0000000000', source: 'web', createdAt: new Date() } : null; },
  } };
  reservations.db = { ...db, $transaction: callback => callback(db) };
  class TestModule {}
  Module({ controllers: [StaffReservationsController], providers: [StaffService, { provide: StaffRepository, useValue: accounts }, { provide: StaffReservationsService, useValue: reservations }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(new ApiErrorFilter());
  try {
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/staff/tenants`;
    const send = (suffix = '', slug = 'demo-a', cookie = `restaurant_staff=${token}`) => fetch(`${root}/${slug}/reservations${suffix}`, { headers: { cookie } });
    assert.equal((await send('', 'demo-a', '')).status, 401);
    assert.equal((await send('', 'demo-b')).status, 401);
    session.revokedAt = new Date(); assert.equal((await send()).status, 401); session.revokedAt = null;
    session.expiresAt = new Date(0); assert.equal((await send()).status, 401); session.expiresAt = new Date(Date.now() + 60000);
    session.staff.role = 'visitor'; assert.equal((await send()).status, 403);
    assert.equal(reads, 0);
    for (const role of ['owner', 'staff']) {
      session.staff.role = role;
      const response = await send('?date=2026-11-10&status=confirmed&page=1');
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json(); assert.equal(body.pageSize, 20); assert.equal(body.total, 1);
      for (const field of ['guestPhone', 'managementTokenHash', 'requestHash', 'idempotencyKey', 'tenantId']) assert.equal(field in body.data[0], false);
      const detail = await send(`/${reservationId}`); assert.equal(detail.status, 200); assert.equal((await detail.json()).data.guestPhone, '0000000000');
    }
    const before = reads;
    for (const suffix of ['?page=1&page=2', '?status=confirmed&status=cancelled', '?tenantId=other', '?date=2026-02-30', '?page=1000', '?pageSize=100']) {
      const response = await send(suffix); assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(reads, before);
    assert.equal((await send('/'+randomUUID())).status, 404);
    dependencyFailure = true;
    const failed = await send(); assert.equal(failed.status, 503);
    assert.equal(JSON.stringify(await failed.json()).includes('Synthetic DB failure'), false);
    assert.equal((await fetch(`${root}/demo-a/reservations`, { method: 'POST' })).status, 404);
  } finally { await app.close(); }
});
