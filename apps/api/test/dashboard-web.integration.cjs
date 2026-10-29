const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { hashPassword, createSessionToken, hashSessionToken } = require('../dist/auth/crypto');

test('dashboard web proxies persist owner changes and reject staff configuration writes', async () => {
  const { databaseUrl } = require('../dist/database/config');
  const url = new URL(databaseUrl());
  assert.ok(url.hostname === '127.0.0.1' && url.port === '55432' && url.pathname === '/restaurant');
  const origin = 'http://127.0.0.1:3000';
  assert.equal((await fetch('http://127.0.0.1:3001/api/v1/health')).status, 200);
  const db = createDatabaseClient(); let tenant;
  try {
    const slug = `dashboard-${randomUUID()}`;
    tenant = await db.tenant.create({ data: { slug, name: 'Synthetic dashboard' } });
    await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic outlet', address: 'Synthetic', contactPhone: '' } });
    const passwordHash = await hashPassword(randomBytes(24).toString('base64url')), cookies = {}, actors = {};
    for (const role of ['owner', 'staff']) {
      const actor = await db.staff.create({ data: { tenantId: tenant.id, username: `probe.${role}`, role, passwordHash } });
      actors[role] = actor.id;
      const token = createSessionToken();
      await db.staffSession.create({ data: { tenantId: tenant.id, staffId: actor.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 120000) } });
      cookies[role] = `senja_staff=${token}; senja_staff_tenant=${slug}`;
    }
    const req = async (path, method = 'GET', body, role = 'owner', requestOrigin = origin) => {
      const response = await fetch(`${origin}${path}`, { method, headers: { cookie: cookies[role] ?? '', origin: requestOrigin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual' });
      if (response.status >= 500) {
        const failure = await response.clone().json().catch(() => ({}));
        const allowed = ['MENU_TIMEOUT', 'MENU_CONNECTION_FAILED', 'MENU_UPSTREAM_REJECTED'];
        assert.fail(`Dashboard ${method} ${path.split('?')[0]} HTTP ${response.status}; category ${allowed.includes(failure.code) ? failure.code : 'UNCLASSIFIED'}; upstream ${Number.isInteger(failure.upstreamStatus) ? failure.upstreamStatus : 'unknown'}`);
      }
      return response;
    };
    const menu = { name: 'Synthetic rendang', description: 'Synthetic', price: 35000, isActive: true, isAvailable: true };
    assert.equal((await req('/staff/menu', 'POST', menu, 'staff')).status, 403);
    assert.equal((await req('/staff/menu', 'POST', menu, 'owner', 'https://other.example')).status, 403);
    const created = await req('/staff/menu', 'POST', menu); assert.equal(created.status, 201); const item = (await created.json()).data;
    assert.equal((await req(`/staff/menu?id=${item.id}`, 'PATCH', { ...menu, price: 36000 })).status, 200);
    assert.equal((await req(`/staff/menu?id=${item.id}&availability=true`, 'PATCH', { isAvailable: false }, 'staff')).status, 200);
    const publicMenu = await fetch(`http://127.0.0.1:3001/api/v1/public/tenants/${slug}/menu`).then(r => r.json());
    assert.equal(publicMenu.data[0].price, 36000); assert.equal(publicMenu.data[0].isAvailable, false);
    const table = { name: 'M01', capacity: 4, isActive: true };
    assert.equal((await req('/staff/tables', 'POST', table, 'staff')).status, 403);
    assert.equal((await req('/staff/tables', 'POST', table)).status, 201);
    const hours = { weekday: 1, openMinute: 660, closeMinute: 1260 };
    assert.equal((await req('/staff/hours', 'PUT', hours, 'staff')).status, 403);
    assert.equal((await req('/staff/hours', 'PUT', hours)).status, 200);
    const profile = { name: 'Synthetic changed', outletName: 'Synthetic changed outlet', address: 'Synthetic changed address', contactPhone: '' };
    assert.equal((await req('/staff/profile', 'PUT', profile, 'staff')).status, 403);
    assert.equal((await req('/staff/profile', 'PUT', profile)).status, 200);
    const special = { date: '2026-11-02', openMinute: null, closeMinute: null };
    assert.equal((await req('/staff/special-hours', 'PUT', special, 'staff')).status, 403);
    assert.equal((await req('/staff/special-hours', 'PUT', special)).status, 200);
    assert.equal((await req('/staff/special-hours?date=2026-11-02', 'GET')).status, 200);
    assert.equal((await req('/staff/special-hours?date=2026-11-02', 'DELETE', undefined, 'staff')).status, 403);
    assert.equal((await req('/staff/special-hours?date=2026-11-02', 'DELETE')).status, 200);
    const audits = await db.operationalAudit.findMany({ where: { tenantId: tenant.id }, select: { staffId: true, action: true } });
    assert.deepEqual(audits.map(row => row.action).sort(), ['menu.created', 'menu.updated', 'menu.availability_changed', 'table.created', 'weekly_hours.saved', 'profile.updated', 'special_hours.saved', 'special_hours.removed'].sort());
    for (const audit of audits) assert.equal(audit.staffId, audit.action === 'menu.availability_changed' ? actors.staff : actors.owner);
    for (const path of ['/staff/menu', '/staff/tables', '/staff/hours', '/staff/profile']) assert.equal((await req(path)).status, 200);
    const currentProfile = await fetch(`http://127.0.0.1:3001/api/v1/public/tenants/${slug}/restaurant`).then(r => r.json());
    assert.equal(currentProfile.data.name, profile.name);
    for (const tab of ['', '?tab=tables', '?tab=hours', '?tab=profile']) assert.equal((await req(`/dashboard${tab}`)).status, 200);
  } finally {
    if (tenant) {
      const where = { tenantId: tenant.id };
      await db.operationalAudit.deleteMany({ where });
      await db.specialHours.deleteMany({ where });
      await db.weeklyHours.deleteMany({ where }); await db.diningTable.deleteMany({ where }); await db.menuItem.deleteMany({ where });
      await db.staffSession.deleteMany({ where }); await db.staff.deleteMany({ where }); await db.outlet.deleteMany({ where }); await db.tenant.delete({ where: { id: tenant.id } });
    }
    await db.$disconnect();
  }
});
