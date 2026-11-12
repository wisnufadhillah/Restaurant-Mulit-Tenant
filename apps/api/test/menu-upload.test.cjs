const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const sharp = require('sharp');
const { MenuImageStorage, MENU_UPLOAD_BYTES } = require('../dist/menu/menu-image-storage');
const { MenuService, menuInput } = require('../dist/menu/menu.service');
const key = `upload-${'a'.repeat(48)}.webp`;
const body = { name: 'Synthetic dish', description: '', price: 10000, isActive: true, isAvailable: true, imageKey: key };
const request = (bytes, type = 'image/png', headers = {}) => Object.assign(Readable.from([bytes]), { headers: { 'content-type': type, ...headers } });

test('raster uploads decode JPEG PNG WebP, strip metadata, bound pixels bytes quota and safe paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'menu-images-'));
  try {
    const storage = new MenuImageStorage(root);
    for (const format of ['jpeg', 'png', 'webp']) {
      const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#bb4422' } })[format]().withMetadata().toBuffer();
      const result = await storage.upload('tenant-a', request(bytes, `image/${format}`), async (key, size) => { assert.match(key, /^upload-[a-f0-9]{48}\.webp$/); assert.ok(size > 0); });
      const metadata = await sharp(await storage.read(result.data.imageKey)).metadata();
      assert.equal(metadata.format, 'webp'); assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
    }
    for (const bytes of [Buffer.from('invalid'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')]) await assert.rejects(storage.upload('tenant-a', request(bytes), async () => {}), { status: 400 });
    await assert.rejects(storage.upload('tenant-a', request(Buffer.alloc(MENU_UPLOAD_BYTES + 1)), async () => {}), { status: 413 });
    const bomb = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
    await assert.rejects(storage.upload('tenant-a', request(bomb), async () => {}), { status: 400 });
    await assert.rejects(storage.read('../unsafe.webp'), { status: 404 });
    await assert.rejects(storage.read(key), { status: 404 });
    storage.busy = true;
    await assert.rejects(storage.upload('tenant-a', request(Buffer.from('x')), async () => {}), { status: 429 });
    storage.busy = false;
    storage.attempts.set('tenant-a', { count: 10, until: Date.now() + 60000 });
    await assert.rejects(storage.upload('tenant-a', request(Buffer.from('x')), async () => {}), { status: 429 });
    await Promise.all(Array.from({ length: 1000 }, (_, i) => writeFile(join(root, `synthetic-${i}`), '')));
    const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer();
    await assert.rejects(storage.upload('tenant-b', request(bytes), async () => {}), { status: 429 });
    assert.equal((await readdir(root)).length, 1003);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('saved upload references require same tenant; public reads require active published reference', async () => {
  assert.equal(menuInput(body).imageKey, key);
  const service = Object.create(MenuService.prototype);
  let query;
  const tx = { menuUpload: { findUnique: async ({ where }) => { assert.equal(where.tenantId_key.tenantId, 'tenant-b'); return null; } } };
  service.db = { $transaction: fn => fn(tx), menuUpload: { findFirst: async input => { query = input; return null; } } };
  await assert.rejects(service.create('tenant-b', body), { status: 400 });
  await assert.rejects(service.update('tenant-b', '30000000-0000-4000-8000-000000000001', body, false), { status: 400 });
  await assert.rejects(service.image(key, undefined, 'demo-padang'), { status: 404 });
  assert.deepEqual(query.where.tenant, { slug: 'demo-padang', status: 'active', menuItems: { some: { imageKey: key, isActive: true } } });
  await assert.rejects(service.image(key, 'tenant-b'), { status: 404 });
  assert.equal(query.where.tenantId, 'tenant-b');
});
