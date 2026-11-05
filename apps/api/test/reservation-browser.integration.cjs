const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('@playwright/test');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');

test('real browser creates, refreshes, cancels and revokes a PostgreSQL reservation through the web proxy', { timeout: 120000 }, async () => {
  assert.equal(process.env.ALLOW_LOCAL_RESERVATION_WRITES, '1', 'Explicit local write approval required');
  const url = new URL(databaseUrl());
  assert.ok(url.hostname === '127.0.0.1' && url.port === '55432' && url.pathname === '/restaurant', 'Only approved local target');
  const run = randomUUID(), slug = `browser-${run}`;
  const origin = 'http://127.0.0.1:3100';
  const previousOrigin = process.env.STAFF_ORIGIN;
  process.env.STAFF_ORIGIN = origin;
  const db = createDatabaseClient();
  let tenantId, app, child, browser;
  try {
    const tenant = await db.tenant.create({ data: { slug, name: 'Synthetic browser restaurant' } }); tenantId = tenant.id;
    const outlet = await db.outlet.create({ data: { tenantId, name: 'Synthetic outlet', address: 'Synthetic address', contactPhone: '' } });
    await db.diningTable.create({ data: { tenantId, outletId: outlet.id, name: 'Only table', capacity: 4 } });
    await db.weeklyHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId, outletId: outlet.id, weekday, openMinute: 0, closeMinute: 1440 })) });
    app = await createApp();
    await app.listen(3101, '127.0.0.1');
    child = spawn(process.execPath, ['apps/web/node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3100'], { env: { ...process.env, NODE_ENV: 'development', API_ORIGIN: 'http://127.0.0.1:3101', STAFF_ORIGIN: origin, RESERVATION_TENANT_SLUG: slug, WEB_DIST_DIR: `.next-browser-${run}` }, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error('Dedicated browser web server exited');
      try { const r = await fetch(origin, { signal: AbortSignal.timeout(1500) }); if (r.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert.ok(ready, 'Dedicated web server readiness');
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${origin}/#reservasi`);
    await page.getByLabel('Tanggal (WIB)').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    await page.getByLabel('Nama', { exact: true }).fill('Tamu Sintetis');
    await page.getByLabel('Nomor telepon').fill('081234567890');
    await page.getByRole('button', { name: 'Periksa meja dan ringkasan' }).click();
    await page.getByRole('heading', { name: 'Periksa reservasi', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Konfirmasi reservasi', exact: true }).click();
    await page.getByText('Reservasi tersimpan. Akses privat tersedia pada browser ini.', { exact: true }).waitFor();
    assert.equal(await db.reservation.count({ where: { tenantId } }), 1);
    assert.equal(await db.reservationEvent.count({ where: { tenantId, toStatus: 'confirmed' } }), 1);
    await db.reservationManagementSession.updateMany({ where: { tenantId }, data: { createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1) } });
    await page.reload();
    await page.getByRole('heading', { name: 'Reservasi terkonfirmasi' }).waitFor();
    assert.equal(await db.reservation.count({ where: { tenantId } }), 1);
    await page.getByRole('button', { name: 'Batalkan reservasi', exact: true }).click();
    await page.getByRole('button', { name: 'Ya, batalkan reservasi' }).click();
    await page.getByRole('heading', { name: 'Reservasi dibatalkan' }).waitFor();
    assert.equal(await db.reservation.count({ where: { tenantId, status: 'cancelled' } }), 1);
    assert.equal(await db.reservationEvent.count({ where: { tenantId, toStatus: 'cancelled' } }), 1);
    await page.getByRole('button', { name: 'Tutup akses privat' }).click();
    await page.getByLabel('Tanggal (WIB)').waitFor();
    const status = await page.evaluate(async () => (await fetch('/reservation/receipt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
    assert.equal(status, 403);
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
    if (app) await app.close();
    try {
      if (tenantId) await db.$transaction(async tx => {
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
    } finally {
      await db.$disconnect();
      if (previousOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = previousOrigin;
    }
  }
});
