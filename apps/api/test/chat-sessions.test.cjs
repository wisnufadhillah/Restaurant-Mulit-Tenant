const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');

test('chat session secret is tenant-bound, expires and revokes independently from public id', () => {
  const service = new ChatSessionsService();
  const session = service.create('demo-padang', 1000);
  assert.equal(service.read(session.token, 'demo-padang', 1001).id, session.id);
  assert.throws(() => service.read(session.id, 'demo-padang', 1001));
  assert.throws(() => service.read(session.token, 'demo-keluarga', 1001));
  assert.throws(() => service.read(session.token, 'demo-padang', session.expiresAt));
  const live = service.create('demo-padang');
  service.revoke(live.token, 'demo-padang');
  assert.throws(() => service.assertActive(live.id, 'demo-padang'));
  assert.throws(() => service.read(live.token, 'demo-padang'));
});
