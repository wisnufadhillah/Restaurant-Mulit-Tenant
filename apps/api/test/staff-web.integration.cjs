const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { hashPassword } = require('../dist/auth/crypto');

// Runs only against the local development servers and removes its own synthetic accounts.
test('web login verifies database session, protects dashboard and revokes logout', async () => {
  const { databaseUrl } = require('../dist/database/config');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant');
  const origin = 'http://127.0.0.1:3000';
  // Check prerequisites before creating fixture rows; never print request bodies or cookies.
  for (const url of ['http://127.0.0.1:3001/api/v1/health', `${origin}/login`]) {
    let response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(5000) }); }
    catch { assert.fail('Local API and web must be running before the auth web test'); }
    assert.equal(response.status, 200, 'Local server readiness check failed');
  }
  const db = createDatabaseClient();
  const accounts = [];
  const password = randomBytes(32).toString('base64url');
  const username = `probe.${randomBytes(8).toString('hex')}`;
  const passwordHash = await hashPassword(password);
  try {
    for (const [slug, role] of [['demo-padang', 'owner'], ['demo-keluarga', 'staff']]) {
      const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
      accounts.push(await db.staff.create({ data: { tenantId: tenant.id, username, passwordHash, role } }));
    }
    const send = (path, body, cookie, requestOrigin = origin) => fetch(`${origin}${path}`, { method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body), redirect: 'manual' });
    assert.equal((await fetch(`${origin}/dashboard`, { redirect: 'manual' })).status, 307);
    assert.equal((await send('/staff/login', { tenantSlug: 'demo-padang', username, password }, undefined, 'https://other.example')).status, 403);
    for (const [slug, role] of [['demo-padang', 'owner'], ['demo-keluarga', 'staff']]) {
      const login = await send('/staff/login', { tenantSlug: slug, username, password });
      if (login.status !== 200) {
        const failure = await login.json();
        const allowed = ['LOGIN_RATE_LIMITED', 'LOGIN_UPSTREAM_UNAVAILABLE', 'LOGIN_REJECTED', 'LOGIN_INVALID_RESPONSE', 'LOGIN_TIMEOUT', 'LOGIN_CONNECTION_FAILED'];
        assert.fail(`Login HTTP ${login.status}; category ${allowed.includes(failure.code) ? failure.code : 'UNKNOWN'}. Keep API stable; do not compile into a watched dist directory during this test.`);
      }
      assert.deepEqual(await login.json(), { ok: true });
      const values = login.headers.getSetCookie();
      assert.equal(values.length, 2);
      assert.ok(values.every(value => /HttpOnly/i.test(value) && /SameSite=strict/i.test(value) && /Path=\//.test(value)));
      const cookie = values.map(value => value.split(';')[0]).join('; ');
      const page = await fetch(`${origin}/dashboard`, { headers: { cookie } });
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes(username) && html.includes(slug));
      assert.ok(html.includes(role === 'owner' ? 'Pemilik' : 'Staff'));
      const token = values.find(value => value.startsWith('senja_staff=')).split(';')[0].slice('senja_staff='.length);
      const otherSlug = slug === 'demo-padang' ? 'demo-keluarga' : 'demo-padang';
      const foreignCookie = `senja_staff=${token}; senja_staff_tenant=${otherSlug}`;
      assert.equal((await fetch(`${origin}/dashboard`, { headers: { cookie: foreignCookie }, redirect: 'manual' })).status, 307);
      assert.equal((await send('/staff/logout', {}, cookie, 'https://other.example')).status, 403);
      assert.equal((await send('/staff/logout', {}, cookie)).status, 200);
      assert.equal((await fetch(`${origin}/dashboard`, { headers: { cookie }, redirect: 'manual' })).status, 307);
    }
  } finally {
    const ids = accounts.map(account => account.id);
    if (ids.length) {
      await db.staffSession.deleteMany({ where: { staffId: { in: ids } } });
      await db.staff.deleteMany({ where: { id: { in: ids } } });
    }
    await db.$disconnect();
  }
});
