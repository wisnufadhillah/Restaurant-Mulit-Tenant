const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { MenuController } = require('../dist/menu/menu.controller');
const { MenuService } = require('../dist/menu/menu.service');
const { StaffService } = require('../dist/auth/staff.service');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { MenuImageStorage } = require('../dist/menu/menu-image-storage');
const sharp = require('sharp');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('menu HTTP saves owner photos, preserves omitted metadata and restricts staff to availability', async () => {
  const token = createSessionToken(), id = '30000000-0000-4000-8000-000000000001';
  const origin = 'http://127.0.0.1:3000';
  const session = { tenantId: 'tenant-a', staffId: 'staff-a', expiresAt: new Date(Date.now() + 60000), revokedAt: null, staff: { id: 'staff-a', tenantId: 'tenant-a', username: 'synthetic.owner', role: 'owner', isActive: true, tenant: { slug: 'demo-padang', status: 'active' } } };
  const accounts = { session: async hash => hash === hashSessionToken(token) ? session : null };
  const menu = Object.create(MenuService.prototype);
  let row, writes = 0;
  const uploads = new Map();
  const storageRoot = await mkdtemp(join(tmpdir(), 'menu-http-'));
  menu.images = new MenuImageStorage(storageRoot);
  const db = { menuItem: {
    create: async ({ data }) => { writes++; row = { id, ...data }; return row; },
    findMany: async ({ where }) => { assert.equal(where.tenantId, 'tenant-a'); return [row]; },
    updateMany: async ({ where, data }) => { assert.equal(where.tenantId, 'tenant-a'); if (where.id !== id) return { count: 0 }; writes++; Object.assign(row, data); return { count: 1 }; },
  }, menuUpload: {
    count: async () => uploads.size,
    create: async ({ data }) => { uploads.set(data.key, data); return data; },
    findUnique: async ({ where }) => { const row = uploads.get(where.tenantId_key.key); return row?.tenantId === where.tenantId_key.tenantId ? row : null; },
    findFirst: async ({ where }) => { const upload = uploads.get(where.key); return upload && (where.tenantId ? upload.tenantId === where.tenantId : row?.isActive && row.imageKey === where.key) ? upload : null; },
  }, operationalAudit: { create: async () => ({}) } };
  menu.db = { ...db, $transaction: callback => callback(db) };
  class TestModule {}
  Module({ controllers: [MenuController], providers: [StaffService, { provide: StaffRepository, useValue: accounts }, { provide: MenuService, useValue: menu }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(new ApiErrorFilter());
  try {
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/staff/tenants/demo-padang/menu`;
    const send = (method, suffix = '', body) => fetch(root + suffix, { method, headers: { cookie: `restaurant_staff=${token}`, origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).png().toBuffer();
    const upload = (extra = {}, bytes = image) => fetch(`${root}/images`, { method: 'POST', headers: { cookie: `restaurant_staff=${token}`, origin, 'content-type': 'image/png', ...extra }, body: bytes });
    assert.equal((await upload({ cookie: '' })).status, 401);
    assert.equal((await upload({ origin: 'https://untrusted.invalid' })).status, 403);
    session.staff.role = 'staff'; assert.equal((await upload()).status, 403); session.staff.role = 'owner';
    assert.equal((await upload({}, Buffer.from('not an image'))).status, 400);
    assert.equal((await upload({}, Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    const uploaded = await upload(); assert.equal(uploaded.status, 201);
    const uploadedKey = (await uploaded.json()).data.imageKey;
    assert.match(uploadedKey, /^upload-[a-f0-9]{48}\.webp$/);
    const privateRead = await fetch(`${root}/images/${uploadedKey}`, { headers: { cookie: `restaurant_staff=${token}` } });
    assert.equal(privateRead.status, 200); assert.equal(privateRead.headers.get('content-type'), 'image/webp'); assert.equal(privateRead.headers.get('x-content-type-options'), 'nosniff');
    const publicUrl = `${await app.getUrl()}/public/tenants/demo-padang/menu/images/${uploadedKey}`;
    assert.equal((await fetch(publicUrl)).status, 404);
    assert.equal((await fetch(`${root}/images/upload-${'f'.repeat(48)}.webp`, { headers: { cookie: `restaurant_staff=${token}` } })).status, 404);
    const body = { name: 'Synthetic dish', description: '', price: 10000, isActive: true, isAvailable: true, imageKey: 'ayam-pop.jpg' };
    assert.equal((await send('POST', '', body)).status, 201);
    assert.equal((await (await send('GET')).json()).data[0].imageKey, body.imageKey);
    const { imageKey, ...legacy } = body;
    assert.equal((await send('PATCH', `/${id}`, legacy)).status, 200);
    assert.equal(row.imageKey, imageKey);
    assert.equal((await send('PATCH', `/${id}`, { ...body, imageKey: 'unknown.jpg' })).status, 400);
    session.staff.role = 'staff';
    const before = writes;
    assert.equal((await send('POST', '', body)).status, 403);
    assert.equal((await send('PATCH', `/${id}`, body)).status, 403);
    assert.equal((await send('PATCH', `/${id}/availability`, { isAvailable: false, imageKey: null })).status, 400);
    assert.equal(writes, before);
    assert.equal((await send('PATCH', `/${id}/availability`, { isAvailable: false })).status, 200);
    assert.equal(row.imageKey, imageKey);
    assert.equal(row.isAvailable, false);
    session.staff.tenant.slug = 'other-tenant';
    assert.equal((await send('GET')).status, 401);
    session.staff.tenant.slug = 'demo-padang'; session.staff.role = 'owner';
    assert.equal((await send('PATCH', `/${id}`, { ...body, imageKey: null })).status, 200);
    assert.equal(row.imageKey, null);
    assert.equal((await send('PATCH', `/${id}`, { ...body, imageKey: uploadedKey })).status, 200);
    assert.equal((await fetch(publicUrl)).status, 200);
    assert.equal((await send('PATCH', `/${id}`, { ...body, imageKey: uploadedKey, isActive: false })).status, 200);
    assert.equal((await fetch(publicUrl)).status, 404);
    const record = uploads.get(uploadedKey); record.tenantId = 'tenant-b';
    assert.equal((await send('PATCH', `/${id}`, { ...body, imageKey: uploadedKey })).status, 400);
    assert.equal((await fetch(`${root}/images/${uploadedKey}`, { headers: { cookie: `restaurant_staff=${token}` } })).status, 404);
  } finally { await app.close(); await rm(storageRoot, { recursive: true, force: true }); }
});
