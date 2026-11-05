const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl } = require('../dist/database/config');
const { createApp } = require('../dist/create-app');

// Uses existing local seed data; no fixtures, migrations or business writes.
test('availability HTTP reads existing local PostgreSQL catalogues without exposing identifiers', async () => {
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only the local synthetic database is permitted');
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/public/tenants`;
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const params = new URLSearchParams({ date, time: '12:00', partySize: '4' });
    for (const slug of ['demo-padang', 'demo-keluarga']) {
      const response = await fetch(`${base}/${slug}/availability?${params}`);
      assert.equal(response.status, 200, 'Existing local seed, outlet and reservation schema must be available');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.source, 'restaurant_api');
      assert.equal(body.data.held, false);
      assert.equal(body.data.timezone, 'Asia/Jakarta');
      assert.equal(body.data.startAt, `${date}T05:00:00.000Z`);
      assert.equal(body.data.endAt, `${date}T06:30:00.000Z`);
      assert.equal(typeof body.data.available, 'boolean');
      assert.deepEqual(Object.keys(body.data).sort(), ['available', 'endAt', 'held', ...(body.data.available ? [] : ['reason']), 'startAt', 'timezone']);
      if (!body.data.available) assert.ok(['hours_unconfigured', 'closed', 'outside_hours', 'no_table'].includes(body.data.reason));
    }
    const unknown = await fetch(`${base}/missing-availability-catalogue/availability?${params}`);
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).error.code, 'NOT_FOUND');
  } finally { await app.close(); }
});
