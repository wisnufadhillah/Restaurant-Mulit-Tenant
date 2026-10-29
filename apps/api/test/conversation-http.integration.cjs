const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');

test('Nest gateway crosses real Python HTTP boundary with redaction, cards and safe fallback', async () => {
  const oldGateway = process.env.ASSISTANT_GATEWAY_TOKEN, oldContext = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.ASSISTANT_GATEWAY_TOKEN = randomBytes(32).toString('base64url');
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('base64url');
  const root = resolve(__dirname, '../../..');
  const child = spawn(resolve(root, 'apps/assistant/.venv/Scripts/python.exe'), [resolve(root, 'apps/assistant/conversation_http_fixture.py')], { cwd: root, env: { ...process.env, INTERNAL_TOOL_SERVICE_TOKEN: randomBytes(32).toString('base64url') }, stdio: ['ignore', 'pipe', 'ignore'] });
  const originalFetch = global.fetch;
  let app;
  try {
    const port = await new Promise((resolvePort, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(new Error('Synthetic Python server readiness timeout')), 15000);
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Synthetic Python server exited')); });
      child.stdout.on('data', chunk => {
        text += chunk.toString();
        if (text.includes('\n')) { clearTimeout(timer); try { resolvePort(JSON.parse(text.split('\n')[0]).port); } catch { reject(new Error('Invalid readiness response')); } }
      });
    });
    global.fetch = (url, options) => originalFetch(url === 'http://127.0.0.1:8001/turn' ? `http://127.0.0.1:${port}/turn` : url, options);
    app = await createApp(); await app.listen(0, '127.0.0.1');
    const session = app.get(ChatSessionsService).create('demo-padang');
    const send = message => originalFetch(`${app.getHttpServer().address().address === '127.0.0.1' ? 'http://127.0.0.1' : ''}:${app.getHttpServer().address().port}/api/v1/chat/messages`, { method: 'POST', headers: { cookie: `restaurant_chat=${session.token}`, origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    const response = await send('Menu? synthetic@example.test');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, 'ok'); assert.equal(result.cards[0].data[0].price, 35000);
    assert.ok(!result.input.includes('synthetic@example.test'));
    const failure = await (await send('Gangguan sintetis')).json();
    assert.equal(failure.status, 'unavailable'); assert.deepEqual(failure.cards, []);
  } finally {
    global.fetch = originalFetch;
    if (app) await app.close();
    child.kill();
    if (oldGateway === undefined) delete process.env.ASSISTANT_GATEWAY_TOKEN; else process.env.ASSISTANT_GATEWAY_TOKEN = oldGateway;
    if (oldContext === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = oldContext;
  }
});
