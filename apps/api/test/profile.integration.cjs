const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { hashPassword, createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
test('profile owner update is atomic and scoped; staff, foreign tenant and Origin are rejected', async () => {
  const db = createDatabaseClient(), app = await createApp(), ids = [];
  try {
    await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api/v1`, slug = `profile-${randomUUID()}`;
    for (const name of [slug, `profile-${randomUUID()}`]) { const tenant = await db.tenant.create({ data: { slug: name, name: 'Synthetic' } }); ids.push(tenant.id); await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic', address: 'Synthetic', contactPhone: '' } }); }
    const cookies = {}, passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
    for (const role of ['owner', 'staff']) { const staff = await db.staff.create({ data: { tenantId: ids[0], username: `probe.${role}`, role, passwordHash } }); const token = createSessionToken(); cookies[role] = `restaurant_staff=${token}`; await db.staffSession.create({ data: { tenantId: ids[0], staffId: staff.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000) } }); }
    const body = { name: 'Synthetic updated', outletName: 'Synthetic outlet updated', address: 'Synthetic test address', contactPhone: '' };
    const send = (role, origin = 'http://127.0.0.1:3000', route = slug, payload = body) => fetch(`${base}/staff/tenants/${route}/profile`, { method: 'PUT', headers: { cookie: cookies[role] ?? '', origin, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal((await send('missing')).status, 401); assert.equal((await send('staff')).status, 403);
    assert.equal((await send('owner', 'https://other.example')).status, 403);
    assert.equal((await send('owner', undefined, slug, { ...body, tenantId: ids[1] })).status, 400);
    const other = await db.tenant.findUniqueOrThrow({ where: { id: ids[1] } });
    assert.equal((await send('owner', undefined, other.slug)).status, 401);
    assert.equal((await send('owner')).status, 200);
    const publicResponse = await fetch(`${base}/public/tenants/${slug}/restaurant`).then(r => r.json());
    assert.equal(publicResponse.data.name, body.name); assert.equal(publicResponse.data.outlets[0].address, body.address);
    assert.equal((await db.tenant.findUniqueOrThrow({ where: { id: ids[1] } })).name, 'Synthetic');
  } finally { await db.operationalAudit.deleteMany({ where: { tenantId: { in: ids } } }); await db.staffSession.deleteMany({ where: { tenantId: { in: ids } } }); await db.staff.deleteMany({ where: { tenantId: { in: ids } } }); await db.outlet.deleteMany({ where: { tenantId: { in: ids } } }); await db.tenant.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); await app.close(); }
});
