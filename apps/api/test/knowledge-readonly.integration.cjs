const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');

test('main API knowledge reads local PostgreSQL without publishing sources and rejects foreign sessions', async () => {
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only local test target permitted');
  const oldService = process.env.INTERNAL_TOOL_SERVICE_TOKEN, oldContext = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.INTERNAL_TOOL_SERVICE_TOKEN = randomBytes(32).toString('hex');
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('hex');
  const db = createDatabaseClient();
  let app;
  try {
    const before = await db.knowledgeDocument.count();
    const snapshots = await db.knowledgeDocument.findMany({ select: { id: true, tenantId: true, activeRevision: true }, orderBy: { id: 'asc' } });
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const sessions = app.get(ChatSessionsService);
    for (const slug of ['demo-padang', 'demo-keluarga']) {
      const active = sessions.create(slug), signed = sessions.context(active.token, slug);
      const headers = { 'x-internal-service-token': process.env.INTERNAL_TOOL_SERVICE_TOKEN, 'x-internal-context': signed.context, 'x-session-id': signed.sessionId };
      const endpoint = `${await app.getUrl()}/api/v1/internal/tenants/${slug}/knowledge?q=kebijakan`;
      const response = await fetch(endpoint, { headers });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.source, 'restaurant_knowledge');
      assert.ok(Array.isArray(body.data) && body.data.length <= 3);
      const tenant = await db.tenant.findUniqueOrThrow({ where: { slug }, select: { id: true } });
      for (const excerpt of body.data) assert.ok(snapshots.some(doc => doc.id === excerpt.documentId && doc.tenantId === tenant.id && doc.activeRevision === excerpt.revision));
      const other = slug === 'demo-padang' ? 'demo-keluarga' : 'demo-padang';
      const foreign = await fetch(endpoint.replace(slug, other), { headers });
      assert.equal(foreign.status, 403);
      assert.equal(foreign.headers.get('cache-control'), 'no-store');
      sessions.revoke(active.token, slug);
      assert.equal((await fetch(endpoint, { headers })).status, 403);
    }
    assert.equal(await db.knowledgeDocument.count(), before);
    assert.deepEqual(await db.knowledgeDocument.findMany({ select: { id: true, tenantId: true, activeRevision: true }, orderBy: { id: 'asc' } }), snapshots);
  } finally {
    try { if (app) await app.close(); } finally {
      await db.$disconnect();
      if (oldService === undefined) delete process.env.INTERNAL_TOOL_SERVICE_TOKEN; else process.env.INTERNAL_TOOL_SERVICE_TOKEN = oldService;
      if (oldContext === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = oldContext;
    }
  }
});
