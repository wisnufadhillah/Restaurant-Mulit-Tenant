const { test } = require('node:test');
const assert = require('node:assert/strict');
const { menuInput } = require('../dist/menu/menu.service');

test('menu validation rejects invalid prices, extra tenant fields and staff price edits', () => {
  const valid = { name: ' Rendang ', description: 'Demo', price: 35000, isActive: true, isAvailable: true };
  assert.equal(menuInput(valid).name, 'Rendang');
  for (const body of [{ ...valid, price: -1 }, { ...valid, price: 1.5 }, { ...valid, tenantId: 'other' }, { ...valid, name: '' }, { ...valid, isActive: 'true' }]) assert.throws(() => menuInput(body), error => error.getStatus() === 400);
  assert.deepEqual(menuInput({ isAvailable: false }, true), { isAvailable: false });
  assert.throws(() => menuInput({ isAvailable: false, price: 1 }, true), error => error.getStatus() === 400);
});
