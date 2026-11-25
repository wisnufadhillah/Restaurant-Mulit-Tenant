const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { ChatMessageController, redactChat } = require('../dist/restaurant/chat-message.controller');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');

test('chat turn binds server context, redacts input and fails safely without retries', async () => {
  const old = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('base64url');
  try {
    assert.ok(!redactChat('Kontak synthetic@example.test +6281234567890').includes('synthetic@example.test'));
    const sessions = new ChatSessionsService(), session = await sessions.create('demo-padang');
    const request = { headers: { origin: 'http://127.0.0.1:3000', cookie: `restaurant_chat=${session.token}` }, socket: {} }, response = { setHeader() {} };
    let calls = 0;
    const transport = { async send(body) { calls++; assert.equal(body.tenantSlug, 'demo-padang'); assert.ok(!body.message.includes('synthetic@example.test')); return { status: 'ok', message: 'Info dari tool', cards: [] }; } };
    const controller = new ChatMessageController(sessions, transport, { publicList: async () => { throw new Error('Synthetic menu failure'); } });
    const result = await controller.send({ message: 'Alamat? Kontak synthetic@example.test' }, request, response);
    assert.equal(result.status, 'ok'); assert.equal(calls, 1); assert.ok(!result.input.includes('synthetic@example.test'));
    transport.send = async () => ({ status: 'partial', message: 'Data API; jawaban terganggu.', cards: [{ type: 'menu', data: [{ id: 'synthetic', name: 'Rendang', description: 'Demo', price: 35000, isAvailable: false }] }] });
    const partial = await controller.send({ message: 'Menu yang tersedia?' }, request, response);
    assert.equal(partial.status, 'partial');
    assert.equal(partial.cards[0].data[0].price, 35000);
    transport.send = async () => { calls++; throw new Error('Synthetic dependency failure'); };
    assert.equal((await controller.send({ message: 'Info?' }, request, response)).status, 'unavailable');
    assert.equal(calls, 2);
    await assert.rejects(controller.send({ message: 'Info?', tenantSlug: 'other' }, request, response));
    await sessions.revoke(session.token, 'demo-padang');
    await assert.rejects(controller.send({ message: 'Info?' }, request, response));
  } finally { if (old === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = old; }
});

test('assistant outage keeps a reservation request on the reservation path', async () => {
  const old = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('base64url');
  try {
    const sessions = new ChatSessionsService(), session = await sessions.create('demo-padang');
    const request = { headers: { origin: 'http://127.0.0.1:3000', cookie: `restaurant_chat=${session.token}` }, socket: {} }, response = { setHeader() {} };
    const transport = { async send() { throw new Error('Synthetic assistant outage'); } };
    const menu = { publicList: async () => ({ data: [{ id: 'synthetic', name: 'Dendeng balado', description: 'Demo', price: 38000, isAvailable: true }] }) };
    const controller = new ChatMessageController(sessions, transport, menu);
    const result = await controller.send({ message: 'Saya ingin reservasi' }, request, response);
    assert.equal(result.status, 'partial');
    assert.match(result.message, /form reservasi/i);
    assert.deepEqual(result.actions, [{ id: 'reservation-form', type: 'navigate', label: 'Buka form reservasi', target: '#reservasi' }]);
    assert.deepEqual(result.cards, []);
  } finally { if (old === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = old; }
});

test('redactChat masks phone variants, emails and long tokens while preserving valid calendar dates', () => {
  const sample = [
    'Hubungi +62 812-3456-7890 atau (021) 555-1234',
    'atau 0812 3456 7890',
    'email saya synthetic.user@example.test',
    'token abcdefghijklmnopqrstuvwxyz123456',
    'untuk tanggal 2026-11-25 dan 25-11-2026.',
  ].join(' ');
  const redacted = redactChat(sample);
  assert.ok(!redacted.includes('812'));
  assert.ok(!redacted.includes('555-1234'));
  assert.ok(!redacted.includes('synthetic.user@example.test'));
  assert.ok(!redacted.includes('abcdefghijklmnopqrstuvwxyz123456'));
  assert.ok(redacted.includes('[nomor disamarkan]'));
  assert.ok(redacted.includes('[kontak disamarkan]'));
  assert.ok(redacted.includes('[nilai privat disamarkan]'));
  assert.ok(redacted.includes('2026-11-25'));
  assert.ok(redacted.includes('25-11-2026'));
});
