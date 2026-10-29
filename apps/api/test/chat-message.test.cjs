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
    const sessions = new ChatSessionsService(), session = sessions.create('demo-padang');
    const request = { headers: { origin: 'http://127.0.0.1:3000', cookie: `restaurant_chat=${session.token}` }, socket: {} }, response = { setHeader() {} };
    let calls = 0;
    const transport = { async send(body) { calls++; assert.equal(body.tenantSlug, 'demo-padang'); assert.ok(!body.message.includes('synthetic@example.test')); return { status: 'ok', message: 'Info dari tool', cards: [] }; } };
    const controller = new ChatMessageController(sessions, transport);
    const result = await controller.send({ message: 'Alamat? Kontak synthetic@example.test' }, request, response);
    assert.equal(result.status, 'ok'); assert.equal(calls, 1); assert.ok(!result.input.includes('synthetic@example.test'));
    transport.send = async () => { calls++; throw new Error('Synthetic dependency failure'); };
    assert.equal((await controller.send({ message: 'Info?' }, request, response)).status, 'unavailable');
    assert.equal(calls, 2);
    await assert.rejects(controller.send({ message: 'Info?', tenantSlug: 'other' }, request, response));
    sessions.revoke(session.token, 'demo-padang');
    await assert.rejects(controller.send({ message: 'Info?' }, request, response));
  } finally { if (old === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = old; }
});
