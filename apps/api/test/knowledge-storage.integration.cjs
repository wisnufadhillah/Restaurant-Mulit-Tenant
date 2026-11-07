const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { knowledgeContentHash } = require('../dist/restaurant/knowledge-publication');

test('local knowledge storage enforces tenant keys, immutable approval and publication pointers', async () => {
  assert.equal(process.env.ALLOW_LOCAL_KNOWLEDGE_WRITES, '1', 'Explicit knowledge write approval required');
  const url = new URL(databaseUrl());
  assert.ok(url.hostname === '127.0.0.1' && url.port === '55432' && url.pathname === '/restaurant', 'Only approved local database permitted');
  const db = createDatabaseClient();
  const rollback = new Error('Synthetic knowledge rollback');
  const tenants = [randomUUID(), randomUUID()];
  try {
    await assert.rejects(db.$transaction(async tx => {
      const document = randomUUID();
      for (const tenant of tenants) await tx.tenant.create({ data: { id: tenant, slug: `knowledge-${tenant}`, name: 'Synthetic knowledge tenant' } });
      await tx.knowledgeDocument.create({ data: { id: document, tenantId: tenants[0] } });
      const content = { title: 'Synthetic FAQ', chunks: [{ position: 0, text: 'Synthetic source for knowledge storage checks.' }] };
      const hash = knowledgeContentHash(content);
      await tx.knowledgeDocumentRevision.create({ data: { tenantId: tenants[0], documentId: document, revision: 1, title: content.title, contentHash: hash } });
      await tx.knowledgeChunk.create({ data: { tenantId: tenants[0], documentId: document, revision: 1, ...content.chunks[0] } });
      // Flush earlier valid deferred events outside each negative-case savepoint.
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
      async function rejected(action, code) {
        await tx.$executeRawUnsafe('SAVEPOINT knowledge_check');
        let captured;
        try { await action(); await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE'); }
        catch (error) { captured = error; }
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT knowledge_check');
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT knowledge_check');
        assert.ok(captured, 'Database must reject invalid knowledge state');
        const original = captured.meta?.driverAdapterError?.cause?.originalCode;
        assert.ok(original === code || (code === '23503' && captured.code === 'P2003'), 'Expected database constraint category');
      }
      await rejected(() => tx.$executeRaw`INSERT INTO knowledge_chunks (tenant_id, document_id, revision, position, text) VALUES (${tenants[1]}::uuid, ${document}::uuid, 1, 0, 'Synthetic foreign chunk')`, '23503');
      await rejected(() => tx.$executeRaw`UPDATE knowledge_documents SET active_revision = 1 WHERE tenant_id = ${tenants[0]}::uuid AND id = ${document}::uuid`, '23514');
      await rejected(() => tx.$executeRaw`UPDATE knowledge_document_revisions SET approved_at = CURRENT_TIMESTAMP WHERE tenant_id = ${tenants[0]}::uuid AND document_id = ${document}::uuid AND revision = 1`, '23514');
      await tx.knowledgeDocumentRevision.update({ where: { tenantId_documentId_revision: { tenantId: tenants[0], documentId: document, revision: 1 } }, data: { approvedAt: new Date(), approvalReference: 'Synthetic approval only', approvedHash: hash } });
      await rejected(() => tx.$executeRaw`UPDATE knowledge_chunks SET text = 'Changed synthetic policy' WHERE tenant_id = ${tenants[0]}::uuid AND document_id = ${document}::uuid AND revision = 1`, '23514');
      await rejected(() => tx.$executeRaw`UPDATE knowledge_document_revisions SET title = 'Changed title' WHERE tenant_id = ${tenants[0]}::uuid AND document_id = ${document}::uuid AND revision = 1`, '23514');
      await tx.knowledgeDocumentRevision.update({ where: { tenantId_documentId_revision: { tenantId: tenants[0], documentId: document, revision: 1 } }, data: { status: 'published', publishedAt: new Date() } });
      await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId: tenants[0], id: document } }, data: { activeRevision: 1 } });
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
      await rejected(() => tx.$executeRaw`UPDATE knowledge_documents SET active_revision = NULL WHERE tenant_id = ${tenants[0]}::uuid AND id = ${document}::uuid`, '23514');
      const persisted = await tx.knowledgeDocument.findUniqueOrThrow({ where: { tenantId_id: { tenantId: tenants[0], id: document } } });
      assert.equal(persisted.activeRevision, 1);
      await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId: tenants[0], id: document } }, data: { activeRevision: null } });
      await tx.knowledgeDocumentRevision.updateMany({ where: { tenantId: tenants[0], documentId: document }, data: { status: 'unpublished' } });
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      throw rollback;
    }, { timeout: 30000 }), error => error === rollback);
    assert.equal(await db.tenant.count({ where: { id: { in: tenants } } }), 0);
  } finally { await db.$disconnect(); }
});
