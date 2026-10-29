const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { signInternalContext } = require('../dist/restaurant/internal-context');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');

test('internal read-only tools require service and signed tenant/session context together', async () => {
  const oldToken = process.env.INTERNAL_TOOL_SERVICE_TOKEN, oldSecret = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.INTERNAL_TOOL_SERVICE_TOKEN = randomBytes(32).toString('base64url');
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('base64url');
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
    const sessions = app.get(ChatSessionsService);
    const session = sessions.create('demo-padang');
    const bound = sessions.context(session.token, 'demo-padang');
    const headers = { 'x-internal-service-token': process.env.INTERNAL_TOOL_SERVICE_TOKEN, 'x-internal-context': bound.context, 'x-session-id': session.id };
    const get = (slug, resource, selected = headers) => fetch(`${base}/api/v1/internal/tenants/${slug}/${resource}`, { headers: selected });
    assert.equal((await get('demo-padang', 'menu', {})).status, 401);
    assert.equal((await get('demo-padang', 'menu', { 'x-internal-service-token': process.env.INTERNAL_TOOL_SERVICE_TOKEN })).status, 403);
    assert.equal((await get('demo-keluarga', 'menu')).status, 403);
    assert.equal((await get('demo-padang', 'menu', { ...headers, 'x-session-id': 'other-session' })).status, 403);
    const expired = signInternalContext({ tenantSlug: 'demo-padang', sessionId: 'synthetic-session', expiresAt: Date.now() - 1 }, process.env.INTERNAL_CONTEXT_SECRET);
    assert.equal((await get('demo-padang', 'menu', { ...headers, 'x-internal-context': expired })).status, 403);
    const profile = await get('demo-padang', 'restaurant'); assert.equal(profile.status, 200); assert.equal((await profile.json()).data.slug, 'demo-padang');
    const menu = await get('demo-padang', 'menu'); assert.equal(menu.status, 200); assert.ok(Array.isArray((await menu.json()).data));
    assert.equal((await fetch(`${base}/api/v1/internal/tenants/demo-padang/menu`, { method: 'POST', headers })).status, 404);
    sessions.revoke(session.token, 'demo-padang');
    assert.equal((await get('demo-padang', 'menu')).status, 403);
  } finally {
    await app.close();
    if (oldToken === undefined) delete process.env.INTERNAL_TOOL_SERVICE_TOKEN; else process.env.INTERNAL_TOOL_SERVICE_TOKEN = oldToken;
    if (oldSecret === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = oldSecret;
  }
});
