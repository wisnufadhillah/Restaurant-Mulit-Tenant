const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
const { Module, ForbiddenException } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { OrdersController } = require('../dist/restaurant/orders.controller');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');
const { ApiErrorFilter } = require('../dist/http/error.filter');

test('order HTTP validates Origin and private scope without database or provider calls', async t => {
  const previous = { ...process.env };
  process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/offline_test';
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  process.env.MIDTRANS_SERVER_KEY = randomUUID();
  process.env.MIDTRANS_SIGNATURE_SECRET = randomUUID();
  process.env.NODE_ENV = 'test';
  delete process.env.STAFF_ORIGIN;
  delete process.env.PAYMENTS_ENABLED;
  t.after(() => { process.env = previous; });
  const id = randomUUID(), tenantId = randomUUID(), sessionId = randomUUID();
  let reads = 0, queries = 0;
  // Use the real controller metadata and replace its database before any request.
  const sessions = { async readForOrders(token) { if (token !== 's'.repeat(43)) throw new ForbiddenException(); reads++; return { id: sessionId, tenantId }; } };
  class TestModule {}
  Module({ controllers: [OrdersController], providers: [{ provide: ChatSessionsService, useValue: sessions }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  const controller = app.get(OrdersController);
  await controller.db.$disconnect();
  controller.db = { order: { async findFirst({ where }) { queries++; assert.deepEqual(where, { id, tenantId, chatSessionId: sessionId }); return { code: 'Demo', paymentStatus: 'pending', orderTotal: 10000 }; } }, $disconnect: async () => {} };
  app.useGlobalFilters(new ApiErrorFilter());
  try {
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/chat/orders`;
    const cookie = `restaurant_chat=${'s'.repeat(43)}`;
    const read = await fetch(`${root}/${id}/status`, { headers: { cookie } });
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('cache-control'), 'no-store');
    for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
      assert.equal((await fetch(`${root}/${id}/status`, { headers: { cookie, ...headers } })).status, 403);
    }
    const invalidCreate = await fetch(root, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(invalidCreate.status, 403);
    assert.equal(invalidCreate.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(root, { method: 'POST', headers: { cookie, origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal((await fetch(`${root}/notification`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal(queries, 1);
    assert.equal(reads, 2);
    const configured = await fetch(`${root}/capabilities`, { headers: { cookie } });
    assert.deepEqual(await configured.json(), { data: { paymentsEnabled: true } });
    const signatureSecret = process.env.MIDTRANS_SIGNATURE_SECRET;
    delete process.env.MIDTRANS_SIGNATURE_SECRET;
    const unavailable = await fetch(`${root}/capabilities`, { headers: { cookie } });
    assert.deepEqual(await unavailable.json(), { data: { paymentsEnabled: false } });
    const readsBefore = reads;
    for (const path of [root, `${root}/notification`]) {
      const missing = await fetch(path, { method: 'POST', headers: { cookie, origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{}' });
      assert.equal(missing.status, 503);
      assert.deepEqual((await missing.json()).error, { code: 'SERVICE_UNAVAILABLE', message: 'Layanan belum tersedia. Silakan coba lagi.' });
    }
    assert.equal(reads, readsBefore);
    assert.equal(queries, 1);
    process.env.MIDTRANS_SIGNATURE_SECRET = signatureSecret;
    process.env.PAYMENTS_ENABLED = 'false';
    delete process.env.MIDTRANS_SERVER_KEY;
    for (const path of [root, `${root}/notification`]) {
      const disabled = await fetch(path, { method: 'POST', headers: { cookie, origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{}' });
      assert.equal(disabled.status, 503);
      assert.equal(disabled.headers.get('cache-control'), 'no-store');
      const body = await disabled.json();
      assert.deepEqual(body.error, { code: 'PAYMENTS_DISABLED', message: 'Pembayaran belum tersedia.' });
    }
    assert.equal(reads, readsBefore);
    assert.equal(queries, 1);
    const capability = await fetch(`${root}/capabilities`, { headers: { cookie } });
    assert.equal(capability.status, 200);
    assert.equal(capability.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await capability.json(), { data: { paymentsEnabled: false } });
    for (const headers of [{}, { cookie, origin: 'https://evil.example' }, { cookie, 'sec-fetch-site': 'cross-site' }]) {
      const denied = await fetch(`${root}/capabilities`, { headers });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await fetch(`${root}/${id}/status`, { headers: { cookie } })).status, 200);
    assert.equal(queries, 2);
  } finally { await app.close(); }
});
