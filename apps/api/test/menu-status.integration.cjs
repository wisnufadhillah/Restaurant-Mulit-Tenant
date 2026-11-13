const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { mkdtemp, readdir, readFile, rm, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const sharp = require('sharp');
const { databaseUrl } = require('../dist/database/config');
const { createDatabaseClient } = require('../dist/database/client');
const { MenuController } = require('../dist/menu/menu.controller');
const { MenuService } = require('../dist/menu/menu.service');
const { MenuImageStorage } = require('../dist/menu/menu-image-storage');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { StaffService } = require('../dist/auth/staff.service');
const { hashSessionToken, createSessionToken } = require('../dist/auth/crypto');
const { StaffReservationsController } = require('../dist/restaurant/staff-reservations.controller');
const { StaffReservationsService } = require('../dist/restaurant/staff-reservations.service');
const { ReservationRepository } = require('../dist/restaurant/reservation.repository');
const { lockReservationTenant } = require('../dist/restaurant/reservation-lock');
const { ApiErrorFilter } = require('../dist/http/error.filter');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const models = ['tenant', 'outlet', 'diningTable', 'staff', 'staffSession', 'menuItem', 'menuUpload', 'operationalAudit', 'reservation', 'reservationEvent', 'reservationManagementSession'];

test('local HTTP menu storage and PostgreSQL reservation competition', { timeout: 120000 }, async t => {
  assert.equal(process.env.ALLOW_LOCAL_MENU_STATUS_WRITES, '1', 'Explicit fixture write approval required');
  const target = new URL(databaseUrl());
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol) && target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only approved local target');
  // All clients are created after both guards. No migration, seed or external service is loaded.
  const db = createDatabaseClient(), worker = createDatabaseClient(), customerDb = createDatabaseClient();
  const tenants = [randomUUID(), randomUUID()], actors = [], bookings = [];
  const storageRoot = await mkdtemp(join(tmpdir(), 'menu-status-'));
  const origin = 'http://127.0.0.1:3197';
  const previousOrigin = process.env.STAFF_ORIGIN;
  process.env.STAFF_ORIGIN = origin;
  let app, baseline, failed = false, failEvent = false, observed = null;
  const counts = async () => Object.fromEntries(await Promise.all(models.map(async model => [model, await db[model].count()])));
  const ownedCounts = async () => ({
    tenants: await db.tenant.count({ where: { id: { in: tenants } } }),
    uploads: await db.menuUpload.count({ where: { tenantId: { in: tenants } } }),
    reservations: await db.reservation.count({ where: { tenantId: { in: tenants } } }),
    events: await db.reservationEvent.count({ where: { tenantId: { in: tenants } } }),
    files: (await readdir(storageRoot)).length,
  });
  try {
    baseline = await counts();
    for (let index = 0; index < 2; index++) {
      const tenantId = tenants[index], slug = `local-menu-status-${tenantId}`;
      await db.tenant.create({ data: { id: tenantId, slug, name: 'Synthetic integration restaurant' } });
      const outlet = await db.outlet.create({ data: { tenantId, name: 'Synthetic outlet', address: 'Synthetic', contactPhone: '' } });
      const table = await db.diningTable.create({ data: { tenantId, outletId: outlet.id, name: 'Synthetic table', capacity: 4 } });
      for (const role of ['owner', 'staff']) {
        const staff = await db.staff.create({ data: { tenantId, username: `synthetic.${role}`, role, passwordHash: randomBytes(32).toString('hex') } });
        const token = createSessionToken();
        await db.staffSession.create({ data: { tenantId, staffId: staff.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 180000) } });
        actors.push({ tenantId, slug, token, staffId: staff.id, role });
      }
      if (!index) {
        for (let n = 0; n < 5; n++) {
          const endAt = new Date(Date.now() + (n === 4 ? 86400000 : -(n + 1) * 7200000));
          bookings.push(await db.reservation.create({ data: {
            tenantId, outletId: outlet.id, tableId: table.id, referenceCode: randomUUID(),
            managementTokenHash: hashSessionToken(createSessionToken()), managementExpiresAt: new Date(endAt.getTime() + 86400000),
            guestName: 'Synthetic guest', guestPhone: '0000000000', partySize: 4,
            startAt: new Date(endAt.getTime() - 5400000), endAt, source: 'web', idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64),
          } }));
        }
      }
    }
    const owner = actors[0], staff = actors[1], foreign = actors[2];
    const menu = Object.create(MenuService.prototype);
    menu.db = db; menu.images = new MenuImageStorage(storageRoot);
    const accounts = Object.create(StaffRepository.prototype); accounts.database = db;
    const transitions = Object.create(StaffReservationsService.prototype); transitions.attempts = new Map();
    const transact = worker.$transaction.bind(worker);
    transitions.db = { $disconnect: () => worker.$disconnect(), $transaction: (callback, options) => transact(async tx => {
      if (observed) {
        const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        observed.push(pid);
      }
      if (!failEvent) return callback(tx);
      // Force a real CHECK violation after the real status UPDATE, without schema changes.
      return callback(new Proxy(tx, { get(target, property) {
        if (property !== 'reservationEvent') return Reflect.get(target, property);
        return { findUnique: args => tx.reservationEvent.findUnique(args), create: args => tx.reservationEvent.create({ ...args, data: { ...args.data, reason: null } }) };
      } }));
    }, options) };
    const customer = Object.create(ReservationRepository.prototype); customer.db = customerDb;
    class TestModule {}
    Module({ controllers: [MenuController, StaffReservationsController], providers: [StaffService, { provide: StaffRepository, useValue: accounts }, { provide: MenuService, useValue: menu }, { provide: StaffReservationsService, useValue: transitions }] })(TestModule);
    app = await NestFactory.create(TestModule, { logger: false });
    app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ApiErrorFilter());
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const menuPath = actor => `/staff/tenants/${actor.slug}/menu`;
    const send = (actor, path, method = 'GET', body, extra = {}) => fetch(base + path, {
      method, headers: { cookie: actor ? `restaurant_staff=${actor.token}` : '', origin, 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
    });
    const transition = (row, key, body, actor = staff) => send(actor, `/staff/tenants/${actor.slug}/reservations/${row.id}/transitions`, 'POST', body, { 'idempotency-key': key });
    const terminal = row => db.reservationEvent.findMany({ where: { tenantId: owner.tenantId, reservationId: row.id, fromStatus: 'confirmed' } });
    const sameState = async (row, expected, count) => {
      assert.equal((await db.reservation.findUniqueOrThrow({ where: { id: row.id } })).status, expected);
      assert.equal((await terminal(row)).length, count);
    };
    const compete = async functions => {
      let release, ready;
      const held = new Promise(resolve => { ready = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const lock = db.$transaction(async tx => { await lockReservationTenant(tx, owner.tenantId); ready(); await gate; }, { timeout: 20000 });
      const pids = []; let pending;
      try {
        await Promise.race([held, lock]);
        observed = pids;
        pending = Promise.allSettled(functions.map(fn => fn()));
        let waiting = 0;
        for (let attempt = 0; attempt < 200; attempt++) {
          const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND lower(wait_event) = 'advisory'`;
          waiting = rows.filter(row => pids.includes(row.pid)).length;
          if (waiting === functions.length) break;
          await pause(20);
        }
        assert.equal(new Set(pids).size, functions.length, 'Distinct real PostgreSQL connections');
        assert.equal(waiting, functions.length, 'Every competing transaction waits on real tenant advisory lock');
      } finally {
        observed = null; release(); await lock;
        // Drain requests before fixture cleanup, including failed barrier assertions.
        if (pending) await pending;
      }
      return pending;
    };
    const check = async (name, callback) => {
      await t.test(name, async () => {
        try { await callback(); }
        catch (error) {
          failed = true;
          console.error(`Integration failure class: ${error.constructor.name}`);
          console.error(`Owned fixture counts: ${JSON.stringify(await ownedCounts())}`);
          throw new Error(`Local integration failed: ${error.constructor.name}`);
        }
      });
      if (failed) throw new Error('Integration stopped after failed check');
    };
    await check('raster upload, ownership, attach/reload, replace/clear and negative HTTP/DB checks', async () => {
      const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#aabbcc' } }).png().toBuffer();
      const upload = (actor = owner, bytes = image, headers = {}) => fetch(base + menuPath(owner) + '/images', { method: 'POST', headers: { cookie: actor ? `restaurant_staff=${actor.token}` : '', origin, 'content-type': 'image/png', ...headers }, body: bytes, signal: AbortSignal.timeout(20000) });
      for (const [actor, bytes, headers, expected] of [[null, image, {}, 401], [foreign, image, {}, 401], [staff, image, {}, 403], [owner, image, { origin: 'https://untrusted.invalid' }, 403], [owner, image, { origin: '' }, 403], [owner, Buffer.from('not a raster'), {}, 400], [owner, image, { 'content-type': 'image/svg+xml' }, 400], [owner, Buffer.alloc(4_000_001), {}, 413]]) {
        assert.equal((await upload(actor, bytes, headers)).status, expected);
      }
      assert.equal(await db.menuUpload.count({ where: { tenantId: owner.tenantId } }), 0);
      assert.equal((await readdir(storageRoot)).length, 0);
      const keys = [];
      for (let n = 0; n < 2; n++) {
        const response = await upload(); assert.equal(response.status, 201);
        const key = (await response.json()).data.imageKey; keys.push(key);
        const record = await db.menuUpload.findUniqueOrThrow({ where: { tenantId_key: { tenantId: owner.tenantId, key } } });
        assert.equal(record.bytes, (await stat(join(storageRoot, key))).size);
        assert.equal((await sharp(await readFile(join(storageRoot, key))).metadata()).format, 'webp');
      }
      const privateRead = (key, actor = owner) => send(actor, menuPath(actor ?? owner) + `/images/${key}`);
      const publicRead = (key, actor = owner) => fetch(`${base}/public/tenants/${actor.slug}/menu/images/${key}`);
      const read = await privateRead(keys[0]); assert.equal(read.status, 200);
      assert.equal(read.headers.get('content-type'), 'image/webp'); assert.equal(read.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await read.arrayBuffer()), await readFile(join(storageRoot, keys[0])));
      assert.equal((await privateRead(keys[0], staff)).status, 200);
      assert.equal((await privateRead(keys[0], null)).status, 401);
      assert.equal((await privateRead(keys[0], foreign)).status, 404);
      assert.equal((await publicRead(keys[0])).status, 404);
      const body = { name: 'Synthetic dish', description: '', price: 10000, isActive: true, isAvailable: true, imageKey: keys[0] };
      const created = await send(owner, menuPath(owner), 'POST', body); assert.equal(created.status, 201);
      const item = (await created.json()).data;
      const reopen = async key => {
        const list = await send(owner, menuPath(owner)); assert.equal(list.status, 200);
        assert.equal((await list.json()).data.find(row => row.id === item.id).imageKey, key);
        const catalogue = await fetch(`${base}/public/tenants/${owner.slug}/menu/catalogue`); assert.equal(catalogue.status, 200);
        assert.equal((await catalogue.json()).data.find(row => row.id === item.id).imageKey, key);
        assert.equal((await db.menuItem.findUniqueOrThrow({ where: { id: item.id } })).imageKey, key);
      };
      await reopen(keys[0]); assert.equal((await publicRead(keys[0])).status, 200);
      assert.equal((await publicRead(keys[0], foreign)).status, 404);
      assert.equal((await send(foreign, menuPath(foreign), 'POST', body)).status, 400);
      assert.equal((await send(staff, menuPath(staff) + `/${item.id}`, 'PATCH', body)).status, 403);
      assert.equal((await send(staff, menuPath(staff) + `/${item.id}/availability`, 'PATCH', { isAvailable: false })).status, 200);
      await reopen(keys[0]);
      assert.equal((await publicRead(keys[0])).status, 200);
      assert.equal((await send(owner, menuPath(owner) + `/${item.id}`, 'PATCH', { ...body, isActive: false })).status, 200);
      assert.equal((await publicRead(keys[0])).status, 404);
      assert.equal((await privateRead(keys[0])).status, 200);
      assert.equal((await send(owner, menuPath(owner) + `/${item.id}`, 'PATCH', body)).status, 200);
      assert.equal((await send(owner, menuPath(owner) + `/${item.id}`, 'PATCH', { ...body, imageKey: 'upload-malformed.webp' })).status, 400);
      for (const data of [{ ...body, tenantId: foreign.tenantId }, { ...body, tenantId: owner.tenantId, imageKey: `upload-${randomBytes(24).toString('hex')}.webp` }]) {
        await assert.rejects(db.menuItem.create({ data }), error => error.code === 'P2003');
      }
      await assert.rejects(db.menuUpload.create({ data: { tenantId: owner.tenantId, key: 'upload-malformed.webp', bytes: 10 } }));
      assert.equal((await send(owner, menuPath(owner) + `/${item.id}`, 'PATCH', { ...body, imageKey: keys[1] })).status, 200);
      await reopen(keys[1]); assert.equal((await publicRead(keys[0])).status, 404); assert.equal((await publicRead(keys[1])).status, 200);
      assert.equal((await send(owner, menuPath(owner) + `/${item.id}`, 'PATCH', { ...body, imageKey: null })).status, 200);
      await reopen(null); assert.equal((await publicRead(keys[1])).status, 404);
      for (const key of keys) assert.equal((await privateRead(key)).status, 200);
      // Replacement and clearing detach references; bounded retained files are intentional.
      assert.equal(await db.menuUpload.count({ where: { tenantId: owner.tenantId } }), 2);
      assert.deepEqual((await readdir(storageRoot)).sort(), keys.sort());
      assert.equal(await db.menuItem.count({ where: { tenantId: foreign.tenantId } }), 0);
    });
    await check('real event constraint failure rolls status back atomically', async () => {
      failEvent = true;
      try { assert.equal((await transition(bookings[0], randomUUID(), { status: 'cancelled', reason: 'Synthetic reason' })).status, 503); }
      finally { failEvent = false; }
      await sameState(bookings[0], 'confirmed', 0);
    });
    await check('parallel same-key HTTP replay on separate PostgreSQL connections records exactly one event', async () => {
      const key = randomUUID(), body = { status: 'cancelled', reason: 'Synthetic reason' };
      const results = await compete([() => transition(bookings[1], key, body), () => transition(bookings[1], key, body)]);
      assert.ok(results.every(result => result.status === 'fulfilled' && result.value.status === 200));
      assert.deepEqual(await results[0].value.json(), await results[1].value.json());
      await sameState(bookings[1], 'cancelled', 1);
      assert.equal((await terminal(bookings[1]))[0].id, key);
      assert.equal((await transition(bookings[1], key, { ...body, reason: 'Changed reason' })).status, 409);
      assert.equal((await transition(bookings[1], key, { status: 'completed' })).status, 409);
      await sameState(bookings[1], 'cancelled', 1);
    });
    await check('different-key completion, no-show and cancellation compete with one terminal event', async () => {
      const results = await compete([{ status: 'completed' }, { status: 'no_show', reviewed: true }, { status: 'cancelled', reason: 'Synthetic reason' }].map(body => () => transition(bookings[2], randomUUID(), body)));
      assert.ok(results.every(result => result.status === 'fulfilled'));
      assert.deepEqual(results.map(result => result.value.status).sort(), [200, 409, 409]);
      const [event] = await terminal(bookings[2]);
      assert.equal(event.fromStatus, 'confirmed'); assert.equal(event.actorType, 'staff');
      await sameState(bookings[2], event.toStatus, 1);
    });
    await check('staff and customer cancellation share real tenant lock and emit one terminal event', async () => {
      const row = bookings[4], tokenHash = hashSessionToken(createSessionToken());
      await db.reservationManagementSession.create({ data: { tenantId: owner.tenantId, reservationId: row.id, tokenHash, expiresAt: new Date(Date.now() + 120000) } });
      const customerTransact = customerDb.$transaction.bind(customerDb);
      customer.db = { $transaction: (callback, options) => customerTransact(async tx => {
        if (observed) { const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`; observed.push(pid); }
        return callback(tx);
      }, options) };
      const results = await compete([() => transition(row, randomUUID(), { status: 'cancelled', reason: 'Synthetic reason' }), () => customer.manage(owner.slug, tokenHash, true, row.referenceCode)]);
      assert.ok(results.every(result => result.status === 'fulfilled'));
      assert.ok([200, 409].includes(results[0].value.status)); assert.equal(results[1].value.status, 'cancelled');
      await sameState(row, 'cancelled', 1);
      const [event] = await terminal(row);
      assert.equal(event.actorType, results[0].value.status === 200 ? 'staff' : 'customer');
      assert.equal((await transition(row, randomUUID(), { status: 'cancelled', reason: 'Synthetic reason' })).status, 409);
      assert.equal((await customer.manage(owner.slug, tokenHash, true, row.referenceCode)).status, 'cancelled');
      await sameState(row, 'cancelled', 1);
    });
  } catch (error) {
    failed = true;
    console.error(`Integration failure class: ${error.constructor.name}`);
    console.error(`Owned fixture counts: ${JSON.stringify(await ownedCounts())}`);
    throw new Error(`Local integration failed: ${error.constructor.name}`);
  } finally {
    try {
      if (app) await app.close();
      // Only descendants of newly generated tenant IDs are eligible for cleanup.
      await db.$transaction(async tx => {
        const where = { tenantId: { in: tenants } };
        for (const model of ['reservationEvent', 'reservationManagementSession', 'reservation', 'operationalAudit', 'menuItem', 'menuUpload', 'staffSession', 'staff', 'diningTable', 'outlet']) await tx[model].deleteMany({ where });
        await tx.tenant.deleteMany({ where: { id: { in: tenants } } });
      });
      assert.deepEqual(await ownedCounts(), { tenants: 0, uploads: 0, reservations: 0, events: 0, files: (await readdir(storageRoot)).length });
      await rm(storageRoot, { recursive: true, force: true });
      await assert.rejects(stat(storageRoot), error => error.code === 'ENOENT');
      if (baseline) assert.deepEqual(await counts(), baseline, 'All model totals return to baseline');
      console.log(`Fixture cleanup: tenants=0 uploads=0 reservations=0 events=0 files=0; baseline model counts unchanged; failed=${Number(failed)}`);
    } finally {
      if (previousOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = previousOrigin;
      await Promise.all([db.$disconnect(), worker.$disconnect(), customerDb.$disconnect()]);
    }
  }
});
