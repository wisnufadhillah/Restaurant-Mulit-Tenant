const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KnowledgePublicationRepository } = require('../dist/restaurant/knowledge-publication.repository');
const { knowledgeContentHash } = require('../dist/restaurant/knowledge-publication');

function boundary(failPointer = false) {
  let state = { activeRevision: 1, statuses: { 1: 'published', 2: 'draft' } };
  const content = { title: 'Synthetic policy', chunks: [{ position: 0, text: 'Synthetic FAQ text.' }] };
  const hash = knowledgeContentHash(content);
  const row = { ...content, contentHash: hash, approvedHash: hash, approvedAt: new Date('2026-01-01'), approvalReference: 'Synthetic approval', publishedAt: null };
  const repository = Object.create(KnowledgePublicationRepository.prototype);
  repository.db = { $transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    const next = structuredClone(state);
    let locks = 0;
    const scoped = key => { assert.equal(key.tenantId, 'tenant-a'); assert.equal(key.documentId ?? key.id, 'document-a'); };
    const tx = {
      $executeRaw: async () => { locks++; },
      knowledgeDocument: {
        findUnique: async args => { assert.equal(locks >= 1, true); scoped(args.where.tenantId_id); return next; },
        update: async args => { scoped(args.where.tenantId_id); if (failPointer) throw new Error('Synthetic pointer failure'); next.activeRevision = args.data.activeRevision; },
      },
      knowledgeDocumentRevision: {
        findUnique: async args => { assert.equal(locks, 2); scoped(args.where.tenantId_documentId_revision); return row; },
        updateMany: async args => { scoped(args.where); for (const revision of [1, 2]) if (next.statuses[revision] === 'published' && revision !== args.where.revision?.not) next.statuses[revision] = args.data.status; },
        update: async args => { scoped(args.where.tenantId_documentId_revision); next.statuses[args.where.tenantId_documentId_revision.revision] = args.data.status; },
      },
    };
    const result = await callback(tx);
    state = next;
    return result;
  } };
  return { repository, row, state: () => state };
}

test('publication replaces revision and unpublishes atomically at database boundary', async () => {
  const b = boundary();
  assert.deepEqual(await b.repository.publish('tenant-a', 'document-a', 2), { documentId: 'document-a', revision: 2 });
  assert.deepEqual(b.state(), { activeRevision: 2, statuses: { 1: 'unpublished', 2: 'published' } });
  await b.repository.unpublish('tenant-a', 'document-a');
  assert.equal(b.state().activeRevision, null);
  assert.equal(b.state().statuses[2], 'unpublished');
});

test('invalid approval and failed pointer update preserve previous publication', async () => {
  const invalid = boundary(); invalid.row.approvedHash = null;
  await assert.rejects(invalid.repository.publish('tenant-a', 'document-a', 2), e => e.getStatus() === 409);
  assert.equal(invalid.state().activeRevision, 1);
  const failed = boundary(true);
  await assert.rejects(failed.repository.publish('tenant-a', 'document-a', 2), { message: 'Synthetic pointer failure' });
  assert.deepEqual(failed.state(), { activeRevision: 1, statuses: { 1: 'published', 2: 'draft' } });
});
