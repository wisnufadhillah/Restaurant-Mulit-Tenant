const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { createSessionToken, hashSessionToken, hashPassword } = require('../dist/auth/crypto');

test('table HTTP rejects unauthorized writes, foreign scope, duplicate names and ambiguous outlets', async () => {
  const db = createDatabaseClient(), app = await createApp(), tenantIds = [];
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`, origin = 'http://127.0.0.1:3000';
    const slug = `tables-${randomUUID()}`, otherSlug = `tables-${randomUUID()}`;
    for (const selected of [slug, otherSlug]) {
      const tenant = await db.tenant.create({ data: { slug: selected, name: 'Synthetic table test' } });
      tenantIds.push(tenant.id);
      await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic outlet', address: 'Synthetic address', contactPhone: '' } });
    }
    const cookies = {};
    const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
    for (const role of ['owner', 'staff']) {
      const account = await db.staff.create({ data: { tenantId: tenantIds[0], username: `probe.${role}`, role, passwordHash } });
      const token = createSessionToken();
      await db.staffSession.create({ data: { tenantId: tenantIds[0], staffId: account.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000) } });
      cookies[role] = `restaurant_staff=${token}`;
    }
    const path = `/staff/tenants/${slug}/tables`;
    const send = (route, method = 'GET', body, role = 'owner', selectedOrigin = origin) => fetch(`${base}${route}`, { method, headers: { cookie: cookies[role] ?? '', 'content-type': 'application/json', ...(selectedOrigin ? { origin: selectedOrigin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const body = { name: 'M01', capacity: 4, isActive: true };
    assert.equal((await send(path, 'GET', undefined, 'missing')).status, 401);
    assert.equal((await send(path, 'GET', undefined, 'staff')).status, 200);
    assert.equal((await send(path, 'POST', body, 'staff')).status, 403);
    for (const invalidOrigin of ['', 'https://other.example']) assert.equal((await send(path, 'POST', body, 'owner', invalidOrigin)).status, 403);
    assert.equal((await send(path, 'POST', { ...body, tenantId: tenantIds[1] })).status, 400);
    assert.equal((await send(path, 'POST', { ...body, capacity: 13 })).status, 400);
    const created = await send(path, 'POST', body);
    assert.equal(created.status, 201);
    const item = (await created.json()).data;
    assert.equal((await send(path, 'POST', body)).status, 409);
    assert.equal((await send(`${path}/${item.id}`, 'PATCH', { ...body, capacity: 6 }, 'staff')).status, 403);
    assert.equal((await send(`/staff/tenants/${otherSlug}/tables`)).status, 401);
    const foreignOutlet = await db.outlet.findFirstOrThrow({ where: { tenantId: tenantIds[1] } });
    const foreign = await db.diningTable.create({ data: { tenantId: tenantIds[1], outletId: foreignOutlet.id, name: 'Foreign', capacity: 2 } });
    assert.equal((await send(`${path}/${foreign.id}`, 'PATCH', body)).status, 404);
    assert.equal((await send(`${path}/${item.id}`, 'PATCH', { ...body, isActive: false })).status, 200);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: item.id } })).isActive, false);
    const extra = await db.outlet.create({ data: { tenantId: tenantIds[0], name: 'Second synthetic outlet', address: 'Synthetic', contactPhone: '' } });
    assert.equal((await send(path)).status, 409);
    assert.equal((await send(path, 'POST', { ...body, name: 'M02' })).status, 409);
    await db.outlet.updateMany({ where: { tenantId: tenantIds[0] }, data: { isActive: false } });
    assert.equal((await send(path)).status, 409);
    assert.ok(extra.id);
  } finally {
    await db.operationalAudit.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.diningTable.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.staffSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.staff.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.outlet.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.$disconnect(); await app.close();
  }
});
