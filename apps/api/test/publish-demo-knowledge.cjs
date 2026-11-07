const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { knowledgeContentHash, assertKnowledgePublishable } = require('../dist/restaurant/knowledge-publication');

async function main() {
  if (process.env.APPROVE_DEMO_KNOWLEDGE_PUBLICATION !== '1') throw new Error('Explicit demo publication approval required');
  const url = new URL(databaseUrl());
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/restaurant') throw new Error('Unapproved publication target');
  const markdown = readFileSync(resolve('docs/FAQ Website.md'), 'utf8');
  const section = markdown.split('## Kandidat pertanyaan dan jawaban')[1]?.split('## Dasar klaim')[0];
  if (!section) throw new Error('FAQ source section missing');
  const items = [...section.matchAll(/### ([^\r\n]+)\r?\n\r?\n([\s\S]*?)(?=\r?\n### |$)/g)].map(match => ({ title: match[1].trim(), chunks: [{ position: 0, text: match[2].trim() }] }));
  if (items.length !== 5) throw new Error('Expected exactly five reviewed FAQ entries');
  const db = createDatabaseClient();
  try {
    const published = await db.$transaction(async tx => {
      const tenant = await tx.tenant.findFirst({ where: { slug: 'demo-padang', status: 'active' }, select: { id: true } });
      if (!tenant) throw new Error('Active demo tenant missing');
      await tx.$executeRaw`SELECT id FROM tenants WHERE id = ${tenant.id}::uuid FOR UPDATE`;
      if (await tx.knowledgeDocument.count({ where: { tenantId: tenant.id } })) throw new Error('Existing knowledge detected; refuse duplicate publication');
      for (const content of items) {
        const documentId = randomUUID(), hash = knowledgeContentHash(content), now = new Date();
        assertKnowledgePublishable({ ...content, contentHash: hash, approvedHash: hash, approvedAt: now, approvalReference: 'Owner-approved website guidance' }, now);
        await tx.knowledgeDocument.create({ data: { id: documentId, tenantId: tenant.id } });
        await tx.knowledgeDocumentRevision.create({ data: { tenantId: tenant.id, documentId, revision: 1, title: content.title, contentHash: hash } });
        await tx.knowledgeChunk.create({ data: { tenantId: tenant.id, documentId, revision: 1, ...content.chunks[0] } });
        await tx.knowledgeDocumentRevision.update({ where: { tenantId_documentId_revision: { tenantId: tenant.id, documentId, revision: 1 } }, data: { approvedAt: now, approvedHash: hash, approvalReference: 'Owner-approved website guidance', status: 'published', publishedAt: now } });
        await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId: tenant.id, id: documentId } }, data: { activeRevision: 1 } });
      }
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      return items.length;
    }, { timeout: 10000 });
    console.log(JSON.stringify({ tenant: 'demo-padang', publishedDocuments: published, revision: 1 }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Demo knowledge publication failed; inspect state before retry'); process.exitCode = 1; });
