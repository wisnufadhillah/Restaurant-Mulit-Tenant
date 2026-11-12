const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { StaffReservationsController } = require('../dist/restaurant/staff-reservations.controller');
const { StaffReservationsService } = require('../dist/restaurant/staff-reservations.service');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { StaffService } = require('../dist/auth/staff.service');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { StaffController } = require('../dist/auth/staff.controller');
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('staff reservation HTTP uses real PostgreSQL tenant scope, pagination and private detail with rollback', { timeout: 120000 }, async () => {
  assert.equal(process.env.ALLOW_LOCAL_STAFF_RESERVATION_WRITES, '1', 'Explicit fixture write approval required');
  const url = new URL(databaseUrl());
  assert.ok(url.hostname === '127.0.0.1' && url.port === '55432' && url.pathname === '/restaurant', 'Only approved local target');
  const db = createDatabaseClient(), tenants = [randomUUID(), randomUUID()];
  const rollback = new Error('Synthetic staff reservation rollback');
  try {
    await assert.rejects(db.$transaction(async tx => {
      const actors = [], bookings = [];
      for (let i = 0; i < 2; i++) {
        const tenantId = tenants[i], slug = `staff-reservations-${tenantId}`;
        await tx.tenant.create({ data: { id: tenantId, slug, name: 'Synthetic staff test' } });
        const outlet = await tx.outlet.create({ data: { tenantId, name: 'Synthetic outlet', address: 'Synthetic', contactPhone: '' } });
        const table = await tx.diningTable.create({ data: { tenantId, outletId: outlet.id, name: 'Synthetic table', capacity: 4 } });
        const staff = await tx.staff.create({ data: { tenantId, username: 'synthetic.operator', role: i ? 'staff' : 'owner', passwordHash: randomBytes(32).toString('hex') } });
        const token = createSessionToken();
        await tx.staffSession.create({ data: { tenantId, staffId: staff.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 180000) } });
        actors.push({ slug, token, staffId: staff.id });
        for (let n = 0; n < (i ? 1 : 21); n++) {
          const startAt = new Date(Date.UTC(2026, 10, 10 + n, 3));
          const endAt = new Date(startAt.getTime() + 90 * 60000);
          const row = await tx.reservation.create({ data: { tenantId, outletId: outlet.id, tableId: table.id, referenceCode: randomUUID(), managementTokenHash: hashSessionToken(createSessionToken()), managementExpiresAt: new Date(endAt.getTime() + 86400000), guestName: i ? 'Foreign Synthetic Guest' : 'Own Synthetic Guest', guestPhone: '0000000000', startAt, endAt, partySize: 4, source: 'web', idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64) } });
          bookings.push(row);
        }
      }
      const service = Object.create(StaffReservationsService.prototype);
      // Actual queries share the fixture transaction; no nested transaction or committed fixtures.
      service.db = { reservation: tx.reservation, $transaction: callback => callback(tx) };
      service.attempts = new Map();
      const accounts = Object.create(StaffRepository.prototype); accounts.database = tx;
      class TestModule {}
      Module({ controllers: [StaffReservationsController, StaffController], providers: [StaffService, { provide: StaffRepository, useValue: accounts }, { provide: StaffReservationsService, useValue: service }] })(TestModule);
      const app = await NestFactory.create(TestModule, { logger: false });
      app.setGlobalPrefix('api/v1');
      app.useGlobalFilters(new ApiErrorFilter());
      try {
        await app.listen(0, '127.0.0.1');
        const base = await app.getUrl();
        const get = (actor, suffix = '', slug = actor.slug) => fetch(`${base}/api/v1/staff/tenants/${slug}/reservations${suffix}`, { headers: { cookie: `restaurant_staff=${actor.token}` } });
        const first = await get(actors[0]); assert.equal(first.status, 200);
        const page = await first.json(); assert.equal(page.total, 21); assert.equal(page.data.length, 20);
        assert.ok(page.data.every(row => row.guestName === 'Own Synthetic Guest' && !('guestPhone' in row) && !('managementTokenHash' in row)));
        const second = await (await get(actors[0], '?page=2')).json(); assert.equal(second.data.length, 1);
        const filtered = await (await get(actors[0], '?date=2026-11-10&status=confirmed')).json(); assert.equal(filtered.total, 1);
        assert.equal((await get(actors[0], `/${bookings[21].id}`)).status, 404);
        assert.equal((await get(actors[0], '', actors[1].slug)).status, 401);
        const own = await (await get(actors[0], `/${bookings[0].id}`)).json(); assert.equal(own.data.guestPhone, '0000000000');
        const other = await (await get(actors[1])).json(); assert.equal(other.total, 1); assert.equal(other.data[0].guestName, 'Foreign Synthetic Guest');
        assert.equal(await tx.reservation.count({ where: { tenantId: { in: tenants } } }), 22);
        // Savepoints model service transaction boundaries without committing fixtures.
        const transitions = Object.create(StaffReservationsService.prototype); transitions.attempts = new Map();
        let failEvent = false;
        transitions.db = { $transaction: async callback => {
          await tx.$executeRaw`SAVEPOINT staff_transition`;
          try {
            const result = await callback({ ...tx, reservationEvent: { findUnique: args => tx.reservationEvent.findUnique(args), create: args => { if (failEvent) throw new Error('Synthetic event failure'); return tx.reservationEvent.create(args); } } });
            await tx.$executeRaw`RELEASE SAVEPOINT staff_transition`; return result;
          } catch (error) { await tx.$executeRaw`ROLLBACK TO SAVEPOINT staff_transition`; throw error; }
        } };
        const eventKey = randomUUID(), selected = bookings[20];
        const transition = (key = eventKey, body = { status: 'cancelled', reason: 'Synthetic reason' }, id = selected.id) => transitions.transition(tenants[0], actors[0].staffId, hashSessionToken(actors[0].token), id, key, body);
        failEvent = true; await assert.rejects(transition(), error => error.getStatus() === 503);
        assert.equal((await tx.reservation.findUnique({ where: { id: selected.id } })).status, 'confirmed');
        assert.equal(await tx.reservationEvent.count({ where: { id: eventKey } }), 0);
        failEvent = false;
        const receipt = await transition(); assert.deepEqual(await transition(), receipt);
        assert.equal(await tx.reservationEvent.count({ where: { id: eventKey } }), 1);
        await assert.rejects(transition(randomUUID()), error => error.getStatus() === 409);
        await assert.rejects(transition(eventKey, { status: 'cancelled', reason: 'Other reason' }), error => error.getStatus() === 409);
        await assert.rejects(transition(eventKey, undefined, bookings[21].id), error => error.getStatus() === 404);
        const activity = await transitions.audit(tenants[0], {}); assert.equal(activity.total, 1); assert.equal(activity.data[0].id, eventKey);
        assert.ok(!JSON.stringify(activity).includes('Synthetic reason')); assert.ok(!JSON.stringify(activity).includes('Own Synthetic Guest'));
        if (process.env.RUN_STAFF_RESERVATION_BROWSER === '1') {
          let child, browser;
          try {
            child = spawn(process.execPath, ['apps/web/node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3120'], { env: { ...process.env, NODE_ENV: 'development', API_ORIGIN: base, STAFF_ORIGIN: 'http://127.0.0.1:3120', WEB_DIST_DIR: `.next-browser-${randomUUID()}` }, stdio: 'ignore' });
            let ready = false;
            for (let i = 0; i < 100; i++) {
              if (child.exitCode !== null) throw new Error('Dedicated dashboard test server exited');
              try { if ((await fetch('http://127.0.0.1:3120/login', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            assert.ok(ready, 'Dedicated dashboard test server ready');
            browser = await chromium.launch();
            for (const [index, viewport] of [[0, { width: 1280, height: 800 }], [1, { width: 390, height: 844 }]]) {
              const context = await browser.newContext({ viewport });
              await context.addCookies([{ name: 'senja_staff', value: actors[index].token, url: 'http://127.0.0.1:3120', httpOnly: true, sameSite: 'Strict' }, { name: 'senja_staff_tenant', value: actors[index].slug, url: 'http://127.0.0.1:3120', httpOnly: true, sameSite: 'Strict' }]);
              const page = await context.newPage();
              await page.goto('http://127.0.0.1:3120/dashboard?tab=reservations');
              await page.getByText(`${index ? 1 : 21} reservasi ditemukan.`, { exact: true }).waitFor();
              assert.equal(await page.locator('tbody tr').count(), index ? 1 : 20);
              if (!index) {
                // Unsubmitted filter edits must not silently alter pagination.
                await page.getByLabel('Tanggal kedatangan (WIB)').fill('2026-11-10');
                await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
                await page.getByText('Halaman 2', { exact: true }).waitFor();
                assert.equal(await page.locator('tbody tr').count(), 1);
                assert.equal(await page.getByText('21 reservasi ditemukan.', { exact: true }).count(), 1);
                await page.getByLabel('Tanggal kedatangan (WIB)').fill('2026-11-10');
                await page.getByRole('button', { name: 'Terapkan filter', exact: true }).click();
                await page.getByText('1 reservasi ditemukan.', { exact: true }).waitFor();
              }
              await page.getByRole('button', { name: /^Lihat detail / }).first().click();
              await page.getByText('0000000000', { exact: true }).waitFor();
              assert.equal(await page.locator('#reservation-detail-heading').evaluate(element => element === document.activeElement), true);
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
              assert.equal(await page.getByRole('button', { name: 'Batalkan reservasi', exact: true }).count(), 1);
              const foreignStatus = await page.evaluate(async id => (await fetch(`/staff/reservations?id=${id}`)).status, index ? bookings[0].id : bookings[21].id);
              assert.equal(foreignStatus, 404);
              await page.getByRole('button', { name: 'Tutup detail', exact: true }).click();
              assert.equal(await page.getByRole('button', { name: /^Lihat detail / }).first().evaluate(element => element === document.activeElement), true);
              await page.goto('http://127.0.0.1:3120/dashboard');
              await page.getByRole('heading', { name: 'Ringkasan reservasi', exact: true }).waitFor();
              await page.waitForFunction(expected => Array.from(document.querySelectorAll('.sela-admin-stats article')).some(article => article.querySelector('p')?.textContent === 'Reservasi' && article.querySelector('strong')?.textContent === expected), String(index ? 1 : 21));
              assert.equal(await page.locator('.sela-reservation-summary li').count(), index ? 1 : 5);
              await page.goto('http://127.0.0.1:3120/dashboard?tab=reservations');
              await page.getByText(`${index ? 1 : 21} reservasi ditemukan.`, { exact: true }).waitFor();
              await page.getByRole('button', { name: /^Lihat detail / }).first().click();
              await page.getByText('0000000000', { exact: true }).waitFor();
              await tx.staffSession.updateMany({ where: { tenantId: tenants[index], tokenHash: hashSessionToken(actors[index].token) }, data: { revokedAt: new Date() } });
              // Desktop exercises list refresh; mobile exercises a detail read after revocation.
              await page.getByRole('button', { name: index ? /^Lihat detail / : 'Muat ulang', exact: !index }).first().click();
              await page.getByRole('alert').filter({ hasText: 'Sesi berakhir' }).waitFor();
              assert.equal(await page.locator('tbody tr').count(), 0);
              assert.equal(await page.getByText('0000000000', { exact: true }).count(), 0);
              assert.equal(await page.locator('#reservation-detail-heading').count(), 0);
              assert.equal(await page.getByText(`${index ? 1 : 21} reservasi ditemukan.`, { exact: true }).count(), 0);
              await context.close();
            }
          } finally {
            try { if (browser) await browser.close(); } finally {
              if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
            }
          }
        }
      } finally { await app.close(); }
      throw rollback;
    }, { timeout: process.env.RUN_STAFF_RESERVATION_BROWSER === '1' ? 100000 : 45000 }), error => error === rollback);
    assert.equal(await db.tenant.count({ where: { id: { in: tenants } } }), 0);
  } finally { await db.$disconnect(); }
});
