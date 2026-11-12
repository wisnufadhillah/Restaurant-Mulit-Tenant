const { test } = require('node:test');
const assert = require('node:assert/strict');
const { menuInput, MenuService } = require('../dist/menu/menu.service');
const { menuImage, menuImages } = require('../dist/menu/menu-images');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

test('menu validation rejects invalid prices, extra tenant fields and staff price edits', () => {
  const valid = { name: ' Rendang ', description: 'Demo', price: 35000, isActive: true, isAvailable: true };
  assert.equal(menuInput(valid).name, 'Rendang');
  for (const body of [{ ...valid, price: -1 }, { ...valid, price: 1.5 }, { ...valid, tenantId: 'other' }, { ...valid, name: '' }, { ...valid, isActive: 'true' }]) assert.throws(() => menuInput(body), error => error.getStatus() === 400);
  assert.deepEqual(menuInput({ isAvailable: false }, true), { isAvailable: false });
  assert.throws(() => menuInput({ isAvailable: false, price: 1 }, true), error => error.getStatus() === 400);
});

test('menu photos allow registered static filenames, null or omitted owner metadata', () => {
  const valid = { name: 'Synthetic dish', description: '', price: 10000, isActive: true, isAvailable: true };
  assert.equal(Object.hasOwn(menuInput(valid), 'imageKey'), false);
  assert.equal(menuInput({ ...valid, imageKey: null }).imageKey, null);
  for (const image of menuImages) assert.equal(menuInput({ ...valid, imageKey: image.key }).imageKey, image.key);
  for (const imageKey of ['', '../ayam-pop.jpg', '/images/ayam-pop.jpg', 'https://example.com/photo.jpg', 'unknown.jpg', {}, 1, undefined]) {
    assert.throws(() => menuInput({ ...valid, imageKey }), error => error.getStatus() === 400);
    assert.equal(menuImage(imageKey), undefined);
  }
  assert.throws(() => menuInput({ isAvailable: false, imageKey: null }, true), error => error.getStatus() === 400);
});

test('registered menu photos exist locally and demo backfill matches registry without changing other fields', () => {
  const migration = readFileSync(resolve(__dirname, '../prisma/migrations/20261111200000_menu_images/migration.sql'), 'utf8');
  for (const image of menuImages) {
    assert.ok(existsSync(resolve(__dirname, '../../web/public/images', image.key)));
    assert.ok(migration.includes(`('${image.label}', '${image.key}')`));
  }
  assert.ok(migration.includes("tenant.slug = 'demo-padang'"));
  assert.ok(migration.includes('item.image_key IS NULL'));
  assert.equal((migration.match(/SET /g) ?? []).length, 1);
  assert.ok(migration.includes('SET "image_key" = photo.image_key'));
});

test('public menu keeps exact tool shape while catalogue explicitly selects image metadata', async () => {
  const service = Object.create(MenuService.prototype);
  service.db = { tenant: { findFirst: async ({ where, select }) => {
    assert.deepEqual(where, { slug: 'demo-padang', status: 'active' });
    assert.deepEqual(select.menuItems.where, { isActive: true });
    const row = { id: 'synthetic', name: 'Renamed dish', description: '', price: 10000, isAvailable: false, imageKey: 'ayam-pop.jpg' };
    return { menuItems: [Object.fromEntries(Object.keys(select.menuItems.select).map(key => [key, row[key]]))] };
  } } };
  assert.deepEqual(Object.keys((await service.publicList('demo-padang')).data[0]).sort(), ['description', 'id', 'isAvailable', 'name', 'price']);
  assert.equal((await service.publicList('demo-padang', true)).data[0].imageKey, 'ayam-pop.jpg');
  await assert.rejects(service.publicList('../other'), error => error.getStatus() === 404);
});
