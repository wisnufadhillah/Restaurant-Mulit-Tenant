const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { hashPassword, verifyPassword, createSessionToken, hashSessionToken } = require('../dist/auth/crypto');

test('password hashing uses distinct salts and verifies without storing plaintext', async () => {
  const input = randomBytes(32).toString('base64url');
  const first = await hashPassword(input);
  const second = await hashPassword(input);
  assert.notEqual(first, second);
  assert.ok(!first.includes(input));
  assert.equal(await verifyPassword(input, first), true);
  assert.equal(await verifyPassword(randomBytes(32).toString('base64url'), first), false);
});

test('malformed stored hashes and excessive inputs fail closed', async () => {
  const candidate = randomBytes(32).toString('base64url');
  for (const hash of ['', 'scrypt$999999999$8$1$00$00', null]) {
    assert.equal(await verifyPassword(candidate, hash), false);
  }
  await assert.rejects(hashPassword('x'.repeat(1025)), { message: 'Invalid password input' });
  await assert.rejects(hashPassword(''), { message: 'Invalid password input' });
  assert.equal(await verifyPassword('', 'invalid'), false);
});

test('session tokens are independent and stored only through deterministic digest', () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  const hash = hashSessionToken(first);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashSessionToken(first), hash);
  assert.notEqual(hashSessionToken(second), hash);
  assert.notEqual(first, hash);
  assert.throws(() => hashSessionToken('../invalid'), { message: 'Invalid session token' });
});
