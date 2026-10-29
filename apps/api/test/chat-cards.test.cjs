const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatedChatCards } = require('../dist/restaurant/chat-cards');
test('chat cards allow only bounded public menu/profile fields and reject private tools', () => {
  const card = { type: 'menu', data: [{ id: 'synthetic', name: 'Rendang', description: 'Demo', price: 35000, isAvailable: true }] };
  assert.equal(validatedChatCards([card])[0].data[0].price, 35000);
  for (const value of [[{ type: 'sql', data: {} }], [{ ...card, data: [{ ...card.data[0], tenantId: 'other' }] }], [{ ...card, data: [{ ...card.data[0], price: -1 }] }], Array(4).fill(card)]) assert.throws(() => validatedChatCards(value));
});
