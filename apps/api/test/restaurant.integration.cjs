const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/create-app');

test('public profiles are scoped, read-only and return safe errors', async () => {
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const get = slug => fetch(`${origin}/api/v1/public/tenants/${slug}/restaurant`);
    const first = await (await get('demo-padang')).json();
    const second = await (await get('demo-keluarga')).json();
    assert.equal(first.data.slug, 'demo-padang');
    assert.equal(second.data.slug, 'demo-keluarga');
    assert.notEqual(first.data.name, second.data.name);
    assert.equal(first.data.outlets.length, 1);
    assert.equal(first.data.outlets[0].durationMinutes, 90);
    assert.ok(Array.isArray(first.data.outlets[0].menuItems));
    assert.ok(Array.isArray(first.data.outlets[0].diningTables));
    assert.ok(Array.isArray(first.data.outlets[0].openingHours));
    assert.equal(first.data.outlets[0].menuItems.every(item => item.isAvailable), true);
    assert.equal(first.data.outlets[0].diningTables.every(table => table.status === 'available'), true);
    assert.equal(first.data.id, undefined);
    assert.equal(first.source, 'restaurant_api');
    assert.ok(Number.isFinite(Date.parse(first.retrieved_at)));
    for (const slug of ['missing-restaurant', 'INVALID']) {
      const response = await get(slug);
      assert.equal(response.status, 404);
      const body = await response.json();
      assert.deepEqual(body.error, { code: 'NOT_FOUND', message: 'Informasi tidak ditemukan.' });
      assert.match(body.request_id, /^[0-9a-f-]{36}$/);
      assert.equal(body.stack, undefined);
    }
    const write = await fetch(`${origin}/api/v1/public/tenants/demo-padang/restaurant`, { method: 'POST' });
    assert.equal(write.status, 404);
  } finally { await app.close(); }
});
