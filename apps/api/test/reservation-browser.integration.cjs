const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readFileSync, writeFileSync } = require('node:fs');
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
  const generatedConfig = ['apps/web/tsconfig.json', 'apps/web/next-env.d.ts'].map(path => ({ path, content: readFileSync(path) }));
  let tenantId, app, child, browser, spawnFailed = false;
  try {
    const tenant = await db.tenant.create({ data: { slug, name: 'Synthetic browser restaurant' } }); tenantId = tenant.id;
    const outlet = await db.outlet.create({ data: { tenantId, name: 'Synthetic outlet', address: 'Synthetic address', contactPhone: '' } });
    await db.diningTable.create({ data: { tenantId, outletId: outlet.id, name: 'Only table', capacity: 4 } });
    await db.weeklyHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId, outletId: outlet.id, weekday, openMinute: 0, closeMinute: 1440 })) });
    app = await createApp();
    await app.listen(3101, '127.0.0.1');
    child = spawn(process.execPath, ['apps/web/node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3100'], { env: { ...process.env, NODE_ENV: 'development', API_ORIGIN: 'http://127.0.0.1:3101', STAFF_ORIGIN: origin, RESERVATION_TENANT_SLUG: slug, WEB_DIST_DIR: `.next-browser-${run}` }, stdio: 'ignore' });
    child.on('error', () => { spawnFailed = true; });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (spawnFailed || child.exitCode !== null) throw new Error('Dedicated browser web server exited');
      try { const r = await fetch(origin, { signal: AbortSignal.timeout(1500) }); if (r.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert.ok(ready, 'Dedicated web server readiness');
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${origin}/#reservasi`);
    const initialSession = await page.evaluate(async () => (await fetch('/reservation/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
    assert.equal(initialSession, 200);
    const sessionUrl = `http://127.0.0.1:3101/api/v1/public/tenants/${slug}/reservations/session`;
    let creationBlocked = false;
    for (let i = 0; i < 21; i++) {
      const response = await fetch(sessionUrl, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
      await response.arrayBuffer();
      if (response.status === 429) { creationBlocked = true; break; }
      assert.equal(response.status, 200);
    }
    assert.ok(creationBlocked, 'New-session peer budget exhausted before valid reuse');
    let dropped = false, upstreamStatus = 0, faultKind = 'none', finishFault;
    const faultFinished = new Promise(resolve => { finishFault = resolve; });
    await page.route('**/reservation/create', async route => {
      if (dropped) return route.continue();
      // Complete real upstream commit before discarding its browser response.
      try {
        const response = await route.fetch({ timeout: 10000 });
        upstreamStatus = response.status();
        if (response.status() !== 200) throw new Error('Unexpected create response');
        dropped = true;
        await route.abort('connectionreset');
      } catch (error) {
        faultKind = error instanceof Error && error.message.includes('ECONNREFUSED') ? 'connection-refused' : error instanceof Error && error.message.includes('Timeout') ? 'timeout' : error instanceof Error && error.message.includes('max') ? 'limit' : 'transport';
        await route.abort('failed').catch(() => {});
      } finally { finishFault(); }
    });
    await page.getByLabel('Tanggal (WIB)').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    await page.getByLabel('Nama', { exact: true }).fill('Tamu Sintetis');
    await page.getByLabel('Nomor telepon').fill('081234567890');
    await page.getByRole('button', { name: 'Periksa meja dan ringkasan' }).click();
    await page.getByRole('heading', { name: 'Periksa reservasi', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Konfirmasi reservasi', exact: true }).click();
    await page.getByRole('button', { name: 'Coba ulang percobaan yang sama', exact: true }).waitFor();
    await faultFinished;
    assert.ok(dropped, `Create response was not discarded after commit; upstream status ${upstreamStatus}; fault ${faultKind}`);
    assert.equal(await db.reservation.count({ where: { tenantId } }), 1);
    await page.getByRole('button', { name: 'Coba ulang percobaan yang sama', exact: true }).click();
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
    const cleanupErrors = [];
    const cleanup = async (stage, run) => {
      let timer;
      try {
        await Promise.race([
          Promise.resolve().then(run),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup deadline exceeded')), 10000); }),
        ]);
      } catch { cleanupErrors.push(new Error(`Cleanup failed: ${stage}`)); }
      finally { clearTimeout(timer); }
    };
    if (browser) {
      for (const context of browser.contexts()) for (const page of context.pages()) await cleanup('browser routes', () => page.unrouteAll({ behavior: 'wait' }));
      await cleanup('browser close', () => browser.close());
    }
    let serverStopped = !child || (spawnFailed && !child.pid);
    await cleanup('web process tree', async () => {
      if (!child || (spawnFailed && !child.pid)) return;
      if (child.exitCode !== null) throw new Error('Web process exited before tree shutdown');
      const ended = once(child, 'exit');
      if (process.platform === 'win32') {
        const stop = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        const [code] = await once(stop, 'exit');
        assert.equal(code, 0);
      } else child.kill('SIGTERM');
      await ended;
      serverStopped = true;
    });
    if (serverStopped) for (const file of generatedConfig) await cleanup('web configuration restore', () => writeFileSync(file.path, file.content));
    else cleanupErrors.push(new Error('Web configuration not restored: server shutdown unconfirmed'));
    if (app) await cleanup('API close', () => app.close());
    await cleanup('database fixtures', async () => {
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
      if (tenantId) assert.equal(await db.tenant.count({ where: { id: tenantId } }), 0);
    });
    await cleanup('database disconnect', () => db.$disconnect());
    if (previousOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = previousOrigin;
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Browser integration cleanup failed');
  }
});
