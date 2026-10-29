const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tableInput } = require('../dist/restaurant/table.service');
test('table configuration validates capacity, name, status and disallows tenant context', () => {
  const valid = { name: ' M01 ', capacity: 4, isActive: true };
  assert.deepEqual(tableInput(valid), { name: 'M01', capacity: 4, isActive: true });
  for (const input of [{ ...valid, capacity: 0 }, { ...valid, capacity: 13 }, { ...valid, capacity: 2.5 }, { ...valid, tenantId: 'other' }, { ...valid, outletId: 'other' }, { ...valid, name: '' }, { ...valid, isActive: 'true' }]) assert.throws(() => tableInput(input), error => error.getStatus() === 400);
});
