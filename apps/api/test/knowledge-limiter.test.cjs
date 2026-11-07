const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KnowledgeLimiter } = require('../dist/restaurant/knowledge-limiter');

test('knowledge concurrency permits four operations and release is idempotent', () => {
  let now = 0;
  const limiter = new KnowledgeLimiter(() => now);
  const releases = Array.from({ length: 4 }, (_, i) => limiter.acquire('demo', `session-${i}`));
  assert.throws(() => limiter.acquire('demo', 'fifth'), e => e.getStatus() === 429);
  releases[0](); releases[0]();
  const release = limiter.acquire('demo', 'fifth');
  assert.throws(() => limiter.acquire('demo', 'sixth'), e => e.getStatus() === 429);
  release(); releases.slice(1).forEach(fn => fn());
  for (let i = 0; i < 20; i++) limiter.acquire('demo', 'bounded')();
  assert.throws(() => limiter.acquire('demo', 'bounded'), e => e.getStatus() === 429);
  now = 60000;
  limiter.acquire('demo', 'bounded')();
});

test('knowledge window reset preserves running operations and global quota rejects new identities', () => {
  let now = 0;
  const limiter = new KnowledgeLimiter(() => now);
  const active = Array.from({ length: 4 }, (_, i) => limiter.acquire('demo', `active-${i}`));
  now = 60000;
  assert.throws(() => limiter.acquire('demo', 'after-window'), e => e.getStatus() === 429);
  active.forEach(release => release());
  for (let i = 0; i < 199; i++) limiter.acquire('demo', `independent-${i}`)();
  assert.throws(() => limiter.acquire('demo', 'over-global'), e => e.getStatus() === 429);
});
