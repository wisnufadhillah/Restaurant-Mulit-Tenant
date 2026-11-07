const { test } = require('node:test');
const assert = require('node:assert/strict');
const { knowledgeContentHash, assertKnowledgePublishable } = require('../dist/restaurant/knowledge-publication');
const content = () => ({ title: 'Panduan sintetis', chunks: [{ position: 0, text: 'Gunakan form web untuk reservasi sintetis.' }] });

test('approval binds title and ordered chunks rather than a mutable reference alone', () => {
  const hash = knowledgeContentHash(content());
  assert.match(hash, /^[a-f0-9]{64}$/);
  const approved = { ...content(), contentHash: hash, approvedHash: hash, approvedAt: new Date('2026-11-06T01:00:00Z'), approvalReference: 'Synthetic approval' };
  assert.doesNotThrow(() => assertKnowledgePublishable(approved, new Date('2026-11-06T02:00:00Z')));
  assert.throws(() => assertKnowledgePublishable({ ...approved, title: 'Changed title' }, new Date('2026-11-06T02:00:00Z')));
  assert.throws(() => assertKnowledgePublishable({ ...approved, approvedHash: null }, new Date('2026-11-06T02:00:00Z')));
  assert.throws(() => assertKnowledgePublishable({ ...approved, chunks: [{ position: 0, text: 'Changed policy' }] }, new Date('2026-11-06T02:00:00Z')));
  assert.throws(() => assertKnowledgePublishable(approved, new Date('2026-11-06T00:00:00Z')));
});

test('knowledge content hash is deterministic and rejects ambiguous or unbounded chunks', () => {
  const ordered = { title: 'Synthetic', chunks: [{ position: 0, text: 'First' }, { position: 1, text: 'Second' }] };
  assert.equal(knowledgeContentHash(ordered), knowledgeContentHash({ ...ordered, chunks: [...ordered.chunks].reverse() }));
  for (const chunks of [[], [{ position: 1, text: 'Gap' }], [{ position: 0, text: 'A' }, { position: 0, text: 'B' }], [{ position: 0, text: 'x'.repeat(2001) }]]) assert.throws(() => knowledgeContentHash({ title: 'Synthetic', chunks }));
});
