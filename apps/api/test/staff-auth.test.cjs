const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { StaffController } = require('../dist/auth/staff.controller');
const { StaffService } = require('../dist/auth/staff.service');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { hashPassword, hashSessionToken, createSessionToken } = require('../dist/auth/crypto');

test('staff HTTP authentication binds tenant, validates origin, expires and revokes sessions', async () => {
  const password = randomBytes(32).toString('base64url');
  const account = { id: 'staff-a', tenantId: 'tenant-a', username: 'demo.staff', passwordHash: await hashPassword(password), role: 'staff', isActive: true, tenant: { status: 'active', slug: 'demo-a' } };
  const sessions = new Map();
  let lookups = 0;
  const repository = {
    async account(slug, username) { lookups++; return slug === 'demo-a' && username === account.username ? account : null; },
    async createSession(data) { sessions.set(data.tokenHash, { ...data, revokedAt: null, staff: account }); },
    async session(hash) { return sessions.get(hash) ?? null; },
    async revoke(hash) { const session = sessions.get(hash); if (session) session.revokedAt = new Date(); },
  };
  class TestModule {}
  Module({ controllers: [StaffController], providers: [StaffService, { provide: StaffRepository, useValue: repository }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiErrorFilter());
  const originalOrigin = process.env.STAFF_ORIGIN;
  const originalMode = process.env.NODE_ENV;
  process.env.STAFF_ORIGIN = 'http://127.0.0.1:3000';
  process.env.NODE_ENV = 'test';
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/staff`;
    const login = (body, origin = process.env.STAFF_ORIGIN) => fetch(`${base}/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
    const body = { tenantSlug: 'demo-a', username: account.username, password };
    assert.equal((await login(body, 'https://other.example')).status, 403);
    assert.equal((await login(body, '')).status, 403);
    assert.equal(lookups, 0);
    assert.equal((await login({ ...body, role: 'owner' })).status, 400);
    assert.equal((await login({ ...body, tenantSlug: 'demo-b' })).status, 401);
    assert.equal((await login({ ...body, password: randomBytes(32).toString('base64url') })).status, 401);
    assert.equal((await login(body, 'http://localhost:3000')).status, 200);
    const response = await login(body);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const cookieHeader = response.headers.get('set-cookie');
    assert.ok(cookieHeader.includes('HttpOnly') && cookieHeader.includes('SameSite=Strict') && cookieHeader.includes('Path=/api/v1/staff'));
    const cookie = cookieHeader.split(';')[0];
    const token = cookie.slice(cookie.indexOf('=') + 1);
    assert.ok(sessions.has(hashSessionToken(token)));
    assert.ok(!sessions.has(token));
    assert.deepEqual(await response.json(), { data: { id: account.id, tenantId: account.tenantId, username: account.username, role: 'staff' } });
    const read = (slug = 'demo-a', selectedCookie = cookie) => fetch(`${base}/tenants/${slug}/session`, { headers: selectedCookie ? { cookie: selectedCookie } : {} });
    assert.equal((await read()).status, 200);
    assert.equal((await read('demo-b')).status, 401);
    assert.equal((await read('demo-a', '')).status, 401);
    assert.equal((await read('demo-a', 'restaurant_staff=invalid')).status, 401);
    assert.equal((await read('demo-a', `restaurant_staff=${createSessionToken()}`)).status, 401);
    assert.equal((await read('demo-a', `${cookie}; ${cookie}`)).status, 401);
    const service = app.get(StaffService);
    await assert.rejects(service.authenticate(token, 'demo-a', ['owner']), error => error.getStatus() === 403);
    account.role = 'owner';
    assert.equal((await service.authenticate(token, 'demo-a', ['owner'])).role, 'owner');
    account.role = 'unexpected';
    assert.equal((await read()).status, 403);
    account.role = 'staff';
    account.isActive = false;
    assert.equal((await read()).status, 401);
    account.isActive = true;
    account.tenant.status = 'inactive';
    assert.equal((await read()).status, 401);
    account.tenant.status = 'active';
    const session = sessions.get(hashSessionToken(token));
    session.tenantId = 'tenant-b';
    assert.equal((await read()).status, 401);
    session.tenantId = 'tenant-a';
    session.staffId = 'staff-b';
    assert.equal((await read()).status, 401);
    session.staffId = 'staff-a';
    session.expiresAt = new Date(Date.now() - 1);
    assert.equal((await read()).status, 401);
    session.expiresAt = new Date(Date.now() + 60000);
    const logout = origin => fetch(`${base}/tenants/demo-a/logout`, { method: 'POST', headers: { cookie, origin } });
    const foreignLogout = await fetch(`${base}/tenants/demo-b/logout`, { method: 'POST', headers: { cookie, origin: process.env.STAFF_ORIGIN } });
    assert.equal(foreignLogout.status, 401);
    assert.equal((await logout('https://other.example')).status, 403);
    assert.equal((await read()).status, 200);
    assert.equal((await logout(process.env.STAFF_ORIGIN)).status, 204);
    assert.equal((await read()).status, 401);
    for (let i = 0; i < 5; i++) await login({ ...body, username: 'missing.user' });
    assert.equal((await login({ ...body, username: 'missing.user' })).status, 429);
    assert.equal((await login({ ...body, username: 'x'.repeat(65) })).status, 400);
    process.env.NODE_ENV = 'production';
    process.env.STAFF_ORIGIN = 'https://restaurant.example';
    const secure = await login(body, process.env.STAFF_ORIGIN);
    assert.equal(secure.status, 200);
    assert.ok(secure.headers.get('set-cookie').includes('; Secure'));
    delete process.env.STAFF_ORIGIN;
    assert.equal((await login(body, 'https://restaurant.example')).status, 503);
  } finally {
    if (originalOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = originalOrigin;
    if (originalMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalMode;
    await app.close();
  }
});
