const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { knowledgeContentHash } = require('../dist/restaurant/knowledge-publication');
const { KnowledgeRepository } = require('../dist/restaurant/knowledge.repository');
const { KnowledgeController } = require('../dist/restaurant/knowledge.controller');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { validatedChatCards } = require('../dist/restaurant/chat-cards');

function pythonTurn(base, slug, headers) {
  const code = `import asyncio,json,sys,httpx\nfrom agent_factory import ModelSettings\nfrom conversation_runner import run_conversation\nconfig=json.load(sys.stdin)\nclass LocalTransport(httpx.AsyncBaseTransport):\n async def handle_async_request(self, request):\n  url=httpx.URL(config['base']+request.url.raw_path.decode())\n  async with httpx.AsyncClient(trust_env=False) as client:\n   response=await client.get(url,headers=dict(request.headers))\n  return httpx.Response(response.status_code,content=response.content,headers=response.headers,request=request)\ndef model(request):\n return httpx.Response(200,json={'id':'synthetic','object':'chat.completion','created':1,'model':'example/demo:free','choices':[{'index':0,'message':{'role':'assistant','content':'Gunakan panduan yang sesuai dan jangan membuat reservasi baru saat hasil belum pasti.'},'finish_reason':'stop'}]})\nasync def main():\n result=await run_conversation('Kebijakan kue sintetis?',ModelSettings('example/demo:free',('example/demo:free',),'synthetic-test-value'),config['slug'],config['headers'],api_transport=LocalTransport(),model_transport=httpx.MockTransport(model))\n print(json.dumps(result))\nasyncio.run(main())`;
  return new Promise((resolveResult, reject) => {
    const child = spawn(resolve('apps/assistant/.venv/Scripts/python.exe'), ['-c', code], { cwd: resolve('apps/assistant'), stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', size = 0;
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Synthetic Python turn timed out')); }, 15000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size <= 65536) output += chunk; });
    child.stderr.on('data', () => {}); // Never expose SDK internals or private request headers.
    child.on('error', () => { clearTimeout(timeout); reject(new Error('Python fixture process unavailable')); });
    child.on('exit', code => { clearTimeout(timeout); if (code || size > 65536) reject(new Error('Python fixture turn failed')); else { try { resolveResult(JSON.parse(output)); } catch { reject(new Error('Invalid fixture response')); } } });
    child.stdin.end(JSON.stringify({ base, slug, headers }));
  });
}

test('synthetic PostgreSQL sources reach HTTP, Python FAQ gate and API card validator with rollback', { timeout: 60000 }, async () => {
  assert.equal(process.env.ALLOW_LOCAL_KNOWLEDGE_WRITES, '1', 'Explicit knowledge pipeline write approval required');
  const url = new URL(databaseUrl());
  assert.ok(url.hostname === '127.0.0.1' && url.port === '55432' && url.pathname === '/restaurant', 'Only approved local target');
  const oldService = process.env.INTERNAL_TOOL_SERVICE_TOKEN, oldContext = process.env.INTERNAL_CONTEXT_SECRET;
  process.env.INTERNAL_TOOL_SERVICE_TOKEN = randomBytes(32).toString('hex');
  process.env.INTERNAL_CONTEXT_SECRET = randomBytes(32).toString('hex');
  const db = createDatabaseClient(), tenantIds = [randomUUID(), randomUUID()];
  const rollback = new Error('Synthetic knowledge pipeline rollback');
  try {
    await assert.rejects(db.$transaction(async tx => {
      const sessions = new ChatSessionsService(), sources = [];
      for (let i = 0; i < tenantIds.length; i++) {
        const tenantId = tenantIds[i], slug = `pipeline-${tenantId}`, documentId = randomUUID();
        await tx.tenant.create({ data: { id: tenantId, slug, name: 'Synthetic FAQ pipeline' } });
        await tx.knowledgeDocument.create({ data: { id: documentId, tenantId } });
        const content = { title: `Synthetic source ${i}`, chunks: [{ position: 0, text: `Kebijakan kue sintetis khusus fixture ${i}; bukan kebijakan restoran nyata.` }] };
        const hash = knowledgeContentHash(content);
        await tx.knowledgeDocumentRevision.create({ data: { tenantId, documentId, revision: 1, title: content.title, contentHash: hash } });
        await tx.knowledgeChunk.create({ data: { tenantId, documentId, revision: 1, ...content.chunks[0] } });
        const now = new Date();
        await tx.knowledgeDocumentRevision.update({ where: { tenantId_documentId_revision: { tenantId, documentId, revision: 1 } }, data: { approvedAt: now, approvedHash: hash, approvalReference: 'Synthetic approval only', status: 'published', publishedAt: now } });
        await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId, id: documentId } }, data: { activeRevision: 1 } });
        sources.push({ tenantId, slug, documentId });
      }
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
      const repository = Object.create(KnowledgeRepository.prototype);
      // Share the rollback transaction; real ORM queries/search still execute, no nested transaction.
      repository.db = { $transaction: callback => callback(tx) };
      class TestModule {}
      Module({ controllers: [KnowledgeController], providers: [{ provide: KnowledgeRepository, useValue: repository }, { provide: ChatSessionsService, useValue: sessions }] })(TestModule);
      const app = await NestFactory.create(TestModule, { logger: false });
      app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ApiErrorFilter());
      try {
        await app.listen(0, '127.0.0.1');
        for (const source of sources) {
          const active = sessions.create(source.slug), signed = sessions.context(active.token, source.slug);
          const headers = { 'x-internal-service-token': process.env.INTERNAL_TOOL_SERVICE_TOKEN, 'x-internal-context': signed.context, 'x-session-id': signed.sessionId };
          const result = await pythonTurn(await app.getUrl(), source.slug, headers);
          assert.equal(result.status, 'ok'); assert.equal(result.attempted_requests, 1);
          const cards = validatedChatCards(result.cards);
          assert.equal(cards.length, 1); assert.equal(cards[0].type, 'knowledge');
          assert.equal(cards[0].data.length, 1); assert.equal(cards[0].data[0].documentId, source.documentId);
          await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId: source.tenantId, id: source.documentId } }, data: { activeRevision: null } });
          await tx.knowledgeDocumentRevision.updateMany({ where: { tenantId: source.tenantId, documentId: source.documentId }, data: { status: 'unpublished' } });
          await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
          await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
          const empty = await pythonTurn(await app.getUrl(), source.slug, headers);
          assert.equal(empty.status, 'ok'); assert.equal(empty.cards[0].data.length, 0);
          assert.match(empty.message, /belum memiliki sumber FAQ/);
        }
      } finally { await app.close(); }
      throw rollback;
    }, { timeout: 45000 }), error => error === rollback);
    assert.equal(await db.tenant.count({ where: { id: { in: tenantIds } } }), 0);
  } finally {
    await db.$disconnect();
    if (oldService === undefined) delete process.env.INTERNAL_TOOL_SERVICE_TOKEN; else process.env.INTERNAL_TOOL_SERVICE_TOKEN = oldService;
    if (oldContext === undefined) delete process.env.INTERNAL_CONTEXT_SECRET; else process.env.INTERNAL_CONTEXT_SECRET = oldContext;
  }
});
