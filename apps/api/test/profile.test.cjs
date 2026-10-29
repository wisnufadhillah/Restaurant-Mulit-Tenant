const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profileInput } = require('../dist/restaurant/profile.controller');
test('profile rejects identity injection, empty names and non-phone contact', () => {
  const value = { name: ' Demo ', outletName: 'Outlet', address: 'Synthetic address', contactPhone: '' };
  assert.equal(profileInput(value).name, 'Demo');
  for (const body of [{ ...value, name: '' }, { ...value, tenantId: 'other' }, { ...value, contactPhone: '<script>' }, { ...value, address: 'a'.repeat(501) }]) assert.throws(() => profileInput(body), error => error.getStatus() === 400);
});
