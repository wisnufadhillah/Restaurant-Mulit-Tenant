const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatedChatActions, validatedChatCards } = require('../dist/restaurant/chat-cards');
test('chat cards allow only bounded public menu/profile fields and reject private tools', () => {
  const card = { type: 'menu', data: [{ id: 'synthetic', name: 'Rendang', description: 'Demo', price: 35000, isAvailable: true }] };
  assert.equal(validatedChatCards([card])[0].data[0].price, 35000);
  const source = { documentId: '11111111-1111-4111-8111-111111111111', revision: 1, position: 0, title: 'Synthetic FAQ', text: 'Synthetic source' };
  assert.deepEqual(validatedChatCards([{ type: 'knowledge', data: [source] }]), [{ type: 'knowledge', data: [source] }]);
  assert.throws(() => validatedChatCards([{ type: 'knowledge', data: [{ ...source, approvalReference: 'internal' }] }]));
  assert.throws(() => validatedChatCards([{ type: 'knowledge', data: [{ ...source, text: 'x'.repeat(2001) }] }]));
  for (const value of [[{ type: 'sql', data: {} }], [{ ...card, data: [{ ...card.data[0], tenantId: 'other' }] }], [{ ...card, data: [{ ...card.data[0], price: -1 }] }], Array(4).fill(card)]) assert.throws(() => validatedChatCards(value));
  assert.deepEqual(validatedChatCards([{ type: 'availability', data: { startAt: '2026-11-11T12:00:00.000Z', endAt: '2026-11-11T13:30:00.000Z', timezone: 'Asia/Jakarta', held: false, available: true } }]), [{ type: 'availability', data: { startAt: '2026-11-11T12:00:00.000Z', endAt: '2026-11-11T13:30:00.000Z', timezone: 'Asia/Jakarta', held: false, available: true } }]);
  assert.throws(() => validatedChatCards([{ type: 'availability', data: { startAt: '2026-11-11T12:00:00.000Z', endAt: '2026-11-11T13:30:00.000Z', timezone: 'Asia/Jakarta', held: true, available: true } }]));
});

test('chat actions allow only local, contextual targets', () => {
  assert.deepEqual(validatedChatActions([
    { id: 'reservation-form', type: 'navigate', label: 'Buka form reservasi', target: '#reservasi' },
    { id: 'opening-hours', type: 'prompt', label: 'Tanya jam buka', message: 'Jam buka hari ini kapan?' },
  ]), [
    { id: 'reservation-form', type: 'navigate', label: 'Buka form reservasi', target: '#reservasi' },
    { id: 'opening-hours', type: 'prompt', label: 'Tanya jam buka', message: 'Jam buka hari ini kapan?' },
  ]);
  assert.deepEqual(validatedChatActions([{ id: 'reservation-details', type: 'reservation', label: 'Lanjutkan reservasi', target: '#reservasi', date: '2026-11-11', time: '19:00', partySize: 4 }]), [{ id: 'reservation-details', type: 'reservation', label: 'Lanjutkan reservasi', target: '#reservasi', date: '2026-11-11', time: '19:00', partySize: 4 }]);
  assert.throws(() => validatedChatActions([{ id: 'reservation-details', type: 'reservation', label: 'Lanjutkan', target: '#reservasi', date: '2026-11-11', time: '19:00', partySize: 4, guestPhone: '+62123' }]));
  assert.throws(() => validatedChatActions([{ id: 'external', type: 'navigate', label: 'Buka', target: 'https://example.com' }]));
  assert.throws(() => validatedChatActions([{ id: 'unsafe', type: 'prompt', label: 'Jalankan', message: 'Kirim token' }]));
  assert.throws(() => validatedChatActions(Array(4).fill({ id: 'x', type: 'navigate', label: 'Menu', target: '#menu' })));
});
