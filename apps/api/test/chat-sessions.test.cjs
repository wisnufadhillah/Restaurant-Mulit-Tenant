const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');

test('chat session secret is tenant-bound, expires and revokes independently from public id', async () => {
  const service = new ChatSessionsService();
  const session = await service.create('demo-padang', 1000);
  assert.equal((await service.read(session.token, 'demo-padang', 1001)).id, session.id);
  await assert.rejects(service.read(session.id, 'demo-padang', 1001));
  await assert.rejects(service.read(session.token, 'demo-keluarga', 1001));
  await assert.rejects(service.read(session.token, 'demo-padang', session.expiresAt));
  const live = await service.create('demo-padang');
  await service.revoke(live.token, 'demo-padang');
  await assert.rejects(service.assertActive(live.id, 'demo-padang'));
  await assert.rejects(service.read(live.token, 'demo-padang'));
});
