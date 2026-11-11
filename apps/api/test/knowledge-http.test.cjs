const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { KnowledgeController } = require('../dist/restaurant/knowledge.controller');
const { KnowledgeRepository } = require('../dist/restaurant/knowledge.repository');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');
const { signInternalContext } = require('../dist/restaurant/internal-context');
const { ApiErrorFilter } = require('../dist/http/error.filter');

test('internal knowledge HTTP rejects invalid contexts and queries before DB, bounds requests and releases failures', async () => {
  const oldService = process.env.INTERNAL_TOOL_SERVICE_TOKEN, oldContext = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.INTERNAL_TOOL_SERVICE_TOKEN = randomBytes(32).toString('hex');
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('hex');
  const sessions = new ChatSessionsService();
  const active = await sessions.create('demo-padang');
  const signed = await sessions.context(active.token, 'demo-padang');
  let calls = 0, fail = false;
  const repository = { async search() { calls++; if (fail) throw new Error('Synthetic failure'); return { data: [], source: 'restaurant_knowledge' }; } };
  class TestModule {}
  Module({ controllers: [KnowledgeController], providers: [{ provide: KnowledgeRepository, useValue: repository }, { provide: ChatSessionsService, useValue: sessions }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(new ApiErrorFilter());
  try {
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/internal/tenants`;
    const headers = { 'x-internal-service-token': process.env.INTERNAL_TOOL_SERVICE_TOKEN, 'x-internal-context': signed.context, 'x-session-id': signed.sessionId };
    const send = (query = 'q=kue', override = {}, slug = 'demo-padang') => fetch(`${root}/${slug}/knowledge?${query}`, { headers: { ...headers, ...override } });
    assert.equal((await send('q=kue', { 'x-internal-service-token': '' })).status, 401);
    assert.equal((await send('q=kue', { 'x-internal-context': 'invalid' })).status, 403);
    assert.equal((await send('q=kue', {}, 'demo-b')).status, 403);
    const expired = signInternalContext({ tenantSlug: 'demo-padang', sessionId: active.id, expiresAt: Date.now() - 1 }, process.env.INTERNAL_CONTEXT_SECRET);
    assert.equal((await send('q=kue', { 'x-internal-context': expired })).status, 403);
    for (const query of ['', 'q=', 'q=a&q=b', 'q=x&tenantId=other', 'q='+ 'x'.repeat(501)]) {
      const response = await send(query); assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(calls, 0);
    fail = true;
    for (let i = 0; i < 5; i++) assert.equal((await send()).status, 503);
    fail = false;
    for (let i = 0; i < 15; i++) { const response = await send(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); }
    const before = calls, denied = await send();
    assert.equal(denied.status, 429); assert.ok(Number(denied.headers.get('retry-after')) > 0); assert.equal(calls, before);
    await sessions.revoke(active.token, 'demo-padang');
    assert.equal((await send()).status, 403); assert.equal(calls, before);
  } finally {
    await app.close();
    if (oldService === undefined) delete process.env.INTERNAL_TOOL_SERVICE_TOKEN; else process.env.INTERNAL_TOOL_SERVICE_TOKEN = oldService;
    if (oldContext === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = oldContext;
  }
});
