const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');
const net = require('node:net');
const { chromium } = require('@playwright/test');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');

async function available(port) {
  await new Promise((done, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('Dedicated test port unavailable')));
    server.listen(port, '127.0.0.1', () => server.close(done));
  });
}
async function ready(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Dedicated test server exited');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(done => setTimeout(done, 300));
  }
  throw new Error('Dedicated test readiness timed out');
}
async function stop(child) {
  if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
}

test('published FAQ reaches real browser through web proxy, API gateway, Python service and PostgreSQL without provider calls', { timeout: 120000 }, async () => {
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only local published corpus permitted');
  for (const port of [3110, 3111, 8111]) await available(port);
  const names = ['STAFF_ORIGIN', 'INTERNAL_TOOL_SERVICE_TOKEN', 'INTERNAL_CONTEXT_SECRET', 'ASSISTANT_GATEWAY_TOKEN', 'ASSISTANT_ORIGIN'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.STAFF_ORIGIN = 'http://127.0.0.1:3110';
  for (const name of ['INTERNAL_TOOL_SERVICE_TOKEN', 'INTERNAL_CONTEXT_SECRET', 'ASSISTANT_GATEWAY_TOKEN']) process.env[name] = randomBytes(32).toString('hex');
  process.env.ASSISTANT_ORIGIN = 'http://127.0.0.1:8111';
  const db = createDatabaseClient();
  let app, python, web, browser;
  const snapshot = () => db.knowledgeDocument.findMany({ orderBy: { id: 'asc' }, select: { id: true, tenantId: true, activeRevision: true } });
  try {
    const before = await snapshot();
    const published = await db.knowledgeDocumentRevision.findMany({ where: { status: 'published', document: { tenant: { slug: 'demo-padang', status: 'active' } } }, select: { documentId: true, revision: true, title: true } });
    const expected = published.find(item => item.title === 'Apakah saya perlu akun untuk menggunakan website?');
    assert.ok(expected, 'Approved local website guidance must already be published; never publish fixtures automatically');
    app = await createApp(); await app.listen(3111, '127.0.0.1');
    // Exercise the production HTTP handler and runner. Replace only private model settings/provider transport.
    // The FAQ deterministic path must not touch the provider; any attempted model request fails the turn.
    const code = `import asyncio,httpx,logging\nfrom http.server import ThreadingHTTPServer\nimport conversation_server as server\nfrom agent_factory import ModelSettings\nfrom conversation_runner import run_conversation\ndef model(request):\n return httpx.Response(200,json={'id':'synthetic','object':'chat.completion','created':1,'model':'example/demo:free','choices':[{'index':0,'message':{'role':'assistant','content':'Gunakan panduan yang sesuai dan jangan membuat reservasi baru saat hasil belum pasti.'},'finish_reason':'stop'}]})\nasync def guarded(*args, **kwargs):\n return await run_conversation(*args, **kwargs,model_transport=httpx.MockTransport(model))\nserver.load_model_settings=lambda *args:ModelSettings('example/demo:free',('example/demo:free',),'synthetic-test-value')\nserver.run_conversation=guarded\nlogging.disable(logging.CRITICAL)\nThreadingHTTPServer(('127.0.0.1',8111),server.ConversationHandler).serve_forever()`;
    python = spawn(resolve('apps/assistant/.venv/Scripts/python.exe'), ['-c', code], { cwd: resolve('apps/assistant'), env: { ...process.env, RESTAURANT_API_ORIGIN: 'http://127.0.0.1:3111' }, stdio: 'ignore' });
    await ready('http://127.0.0.1:8111/health', python);
    web = spawn(process.execPath, ['apps/web/node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3110'], { env: { ...process.env, NODE_ENV: 'development', API_ORIGIN: 'http://127.0.0.1:3111', WEB_DIST_DIR: `.next-browser-${randomUUID()}` }, stdio: 'ignore' });
    await ready('http://127.0.0.1:3110', web);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3110');
    await page.getByRole('button', { name: 'Tanya restoran' }).click();
    await page.getByRole('button', { name: 'Kirim', exact: true }).waitFor();
    await page.getByLabel('Pesan untuk asisten').fill('Apakah saya perlu akun untuk menggunakan website?');
    const responseObserved = page.waitForResponse(response => response.url().endsWith('/chat/messages') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Kirim', exact: true }).click();
    const response = await responseObserved;
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['cache-control'], 'no-store');
    const result = await response.json();
    assert.equal(result.status, 'ok'); assert.equal(result.attempted_requests, 1);
    assert.ok(result.cards.some(card => card.type === 'knowledge' && card.data.some(item => item.documentId === expected.documentId && item.revision === expected.revision)));
    await page.getByRole('group', { name: 'Sumber jawaban', exact: true }).waitFor();
    await page.locator('.sela-chat-card strong').filter({ hasText: expected.title }).waitFor();
    await page.getByText('Versi sumber 1', { exact: true }).first().waitFor();
    await page.getByLabel('Pesan untuk asisten').fill('Apakah tersedia parkir?');
    const emptyObserved = page.waitForResponse(response => response.url().endsWith('/chat/messages') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Kirim', exact: true }).click();
    const empty = await (await emptyObserved).json();
    assert.equal(empty.status, 'ok'); assert.equal(empty.attempted_requests, 0);
    assert.match(empty.message, /belum memiliki sumber FAQ/);
    assert.deepEqual(empty.cards, [{ type: 'knowledge', data: [] }]);
    assert.deepEqual(await snapshot(), before);
  } finally {
    try { if (browser) await browser.close(); } finally {
      try { await stop(web); } finally {
        try { await stop(python); } finally {
          try { if (app) await app.close(); } finally {
            await db.$disconnect();
            for (const name of names) if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
          }
        }
      }
    }
  }
});
