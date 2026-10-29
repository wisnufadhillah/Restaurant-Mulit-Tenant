const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { createSessionToken, hashSessionToken, hashPassword } = require('../dist/auth/crypto');
test('hours HTTP enforces owner writes and publishes only safe tenant-scoped weekly data', async () => {
  const db = createDatabaseClient(), app = await createApp(), ids = [];
  try {
    await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api/v1`, origin = 'http://127.0.0.1:3000';
    const slugs = [`hours-${randomUUID()}`, `hours-${randomUUID()}`];
    for (const slug of slugs) { const tenant = await db.tenant.create({ data: { slug, name: 'Synthetic hours' } }); ids.push(tenant.id); await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic', address: 'Synthetic', contactPhone: '' } }); }
    const cookies = {}, hash = await hashPassword(randomBytes(24).toString('base64url'));
    for (const role of ['owner', 'staff']) { const actor = await db.staff.create({ data: { tenantId: ids[0], username: `probe.${role}`, passwordHash: hash, role } }); const token = createSessionToken(); cookies[role] = `restaurant_staff=${token}`; await db.staffSession.create({ data: { tenantId: ids[0], staffId: actor.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000) } }); }
    const path = `/staff/tenants/${slugs[0]}/hours`, body = { weekday: 1, openMinute: 660, closeMinute: 1260 };
    const send = (route, method = 'GET', payload, role = 'owner', selectedOrigin = origin) => fetch(`${base}${route}`, { method, headers: { cookie: cookies[role] ?? '', 'content-type': 'application/json', ...(selectedOrigin ? { origin: selectedOrigin } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    assert.equal((await send(path, 'GET', null, 'missing')).status, 401);
    assert.equal((await send(path, 'GET', null, 'staff')).status, 200);
    assert.equal((await send(path, 'PUT', body, 'staff')).status, 403);
    for (const selected of ['', 'https://other.example']) assert.equal((await send(path, 'PUT', body, 'owner', selected)).status, 403);
    assert.equal((await send(path, 'PUT', { ...body, tenantId: ids[1] })).status, 400);
    assert.equal((await send(path, 'PUT', { ...body, closeMinute: 600 })).status, 400);
    assert.equal((await send(`/staff/tenants/${slugs[1]}/hours`, 'PUT', body)).status, 401);
    assert.equal((await send(path, 'PUT', body)).status, 200);
    const read = slug => fetch(`${base}/public/tenants/${slug}/hours`).then(r => r.json());
    const published = await read(slugs[0]);
    assert.deepEqual(published.data, [body]); assert.equal(published.timezone, 'Asia/Jakarta'); assert.equal(published.dateExceptionsSupported, false);
    assert.deepEqual((await read(slugs[1])).data, []);
    assert.equal((await send(path, 'PUT', { weekday: 1, openMinute: null, closeMinute: null })).status, 200);
    assert.equal((await read(slugs[0])).data[0].openMinute, null);
    await db.tenant.update({ where: { id: ids[0] }, data: { status: 'inactive' } });
    assert.equal((await fetch(`${base}/public/tenants/${slugs[0]}/hours`)).status, 404);
  } finally {
    await db.operationalAudit.deleteMany({ where: { tenantId: { in: ids } } });
    await db.weeklyHours.deleteMany({ where: { tenantId: { in: ids } } }); await db.staffSession.deleteMany({ where: { tenantId: { in: ids } } }); await db.staff.deleteMany({ where: { tenantId: { in: ids } } }); await db.outlet.deleteMany({ where: { tenantId: { in: ids } } }); await db.tenant.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); await app.close();
  }
});
