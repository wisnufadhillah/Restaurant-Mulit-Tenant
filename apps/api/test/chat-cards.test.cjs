const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatedChatCards } = require('../dist/restaurant/chat-cards');
test('chat cards allow only bounded public menu/profile fields and reject private tools', () => {
  const card = { type: 'menu', data: [{ id: 'synthetic', name: 'Rendang', description: 'Demo', price: 35000, isAvailable: true }] };
  assert.equal(validatedChatCards([card])[0].data[0].price, 35000);
  const source = { documentId: '11111111-1111-4111-8111-111111111111', revision: 1, position: 0, title: 'Synthetic FAQ', text: 'Synthetic source' };
  assert.deepEqual(validatedChatCards([{ type: 'knowledge', data: [source] }]), [{ type: 'knowledge', data: [source] }]);
  assert.throws(() => validatedChatCards([{ type: 'knowledge', data: [{ ...source, approvalReference: 'internal' }] }]));
  assert.throws(() => validatedChatCards([{ type: 'knowledge', data: [{ ...source, text: 'x'.repeat(2001) }] }]));
  for (const value of [[{ type: 'sql', data: {} }], [{ ...card, data: [{ ...card.data[0], tenantId: 'other' }] }], [{ ...card, data: [{ ...card.data[0], price: -1 }] }], Array(4).fill(card)]) assert.throws(() => validatedChatCards(value));
});
