const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KnowledgeRepository } = require('../dist/restaurant/knowledge.repository');
const valid = () => ({ id: 'doc-a', activeRevision: 2, active: { tenantId: 'tenant-a', documentId: 'doc-a', revision: 2, status: 'published', title: 'Synthetic FAQ', chunks: [{ position: 0, text: 'Synthetic kue ulang tahun policy.' }] } });
function boundary(rows) {
  const repository = Object.create(KnowledgeRepository.prototype);
  repository.db = { $transaction: (callback, options) => {
    assert.equal(options.isolationLevel, 'RepeatableRead');
    return callback({ tenant: { findFirst: async args => { assert.deepEqual(args.where, { slug: 'demo-a', status: 'active' }); return { id: 'tenant-a' }; } }, knowledgeDocument: { findMany: async args => {
      assert.equal(args.where.tenantId, 'tenant-a');
      assert.deepEqual(args.where.activeRevision, { not: null });
      assert.equal(args.take, 101);
      assert.equal(args.select.active.select.chunks.take, 101);
      return rows;
    } } });
  } };
  return repository;
}
test('knowledge snapshot scopes candidate reads and returns only public excerpt fields', async () => {
  const result = await boundary([valid()]).search('demo-a', 'kue ulang tahun');
  assert.equal(result.source, 'restaurant_knowledge');
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].documentId, 'doc-a');
  assert.equal('tenantId' in result.data[0], false);
});
test('knowledge snapshot fails closed for mismatched pointer, tenant or publication', async () => {
  for (const change of [{ tenantId: 'tenant-b' }, { status: 'draft' }, { revision: 1 }, { documentId: 'foreign' }]) {
    const item = valid(); Object.assign(item.active, change);
    await assert.rejects(boundary([item]).search('demo-a', 'kue ulang tahun'), /Inconsistent/);
  }
});
test('knowledge rejects document, chunk and aggregate text overflow instead of truncating evidence', async () => {
  await assert.rejects(boundary(Array.from({ length: 101 }, valid)).search('demo-a', 'kue ulang tahun'), /snapshot limit/);
  const tooMany = valid(); tooMany.active.chunks = Array.from({ length: 101 }, (_, position) => ({ position, text: 'Synthetic' }));
  await assert.rejects(boundary([tooMany]).search('demo-a', 'Synthetic'), /chunk limit/);
  const large = valid(); large.active.chunks = Array.from({ length: 100 }, (_, position) => ({ position, text: 'x'.repeat(2000) }));
  await assert.rejects(boundary([large]).search('demo-a', 'Synthetic'), /text budget/);
});
