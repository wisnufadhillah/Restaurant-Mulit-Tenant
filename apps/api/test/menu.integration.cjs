const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { createSessionToken, hashSessionToken, hashPassword } = require('../dist/auth/crypto');

test('menu HTTP enforces roles, tenant isolation, publication and database price constraints', async () => {
  const db = createDatabaseClient(), app = await createApp(), accounts = [], menus = [];
  const origin = 'http://127.0.0.1:3000';
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'demo-padang' } });
    const other = await db.tenant.findUniqueOrThrow({ where: { slug: 'demo-keluarga' } });
    const cookies = {};
    for (const role of ['owner', 'staff']) {
      const account = await db.staff.create({ data: { tenantId: tenant.id, username: `probe.${randomBytes(8).toString('hex')}`, role, passwordHash: await hashPassword(randomBytes(24).toString('base64url')) } });
      accounts.push(account.id);
      const token = createSessionToken();
      await db.staffSession.create({ data: { tenantId: tenant.id, staffId: account.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000) } });
      cookies[role] = `restaurant_staff=${token}`;
    }
    const send = (path, method, body, role = 'owner', selectedOrigin = origin) => fetch(`${base}${path}`, { method, headers: { cookie: cookies[role] ?? '', origin: selectedOrigin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const path = '/staff/tenants/demo-padang/menu';
    const body = { name: `Probe ${randomBytes(4).toString('hex')}`, description: 'Synthetic menu', price: 10000, isActive: true, isAvailable: true };
    assert.equal((await send(path, 'GET', null, 'missing')).status, 401);
    assert.equal((await send(path, 'POST', body, 'staff')).status, 403);
    assert.equal((await send(path, 'POST', body, 'owner', 'https://other.example')).status, 403);
    assert.equal((await send(path, 'POST', { ...body, price: -1 })).status, 400);
    const created = await send(path, 'POST', body);
    assert.equal(created.status, 201);
    const item = (await created.json()).data; menus.push(item.id);
    assert.equal((await send(`${path}/${item.id}/availability`, 'PATCH', { isAvailable: false }, 'staff')).status, 200);
    assert.equal((await send(`${path}/${item.id}`, 'PATCH', body, 'staff')).status, 403);
    assert.equal((await send('/staff/tenants/demo-keluarga/menu', 'GET')).status, 401);
    const foreign = await db.menuItem.create({ data: { tenantId: other.id, name: 'Foreign probe', description: '', price: 1 } }); menus.push(foreign.id);
    assert.equal((await send(`${path}/${foreign.id}`, 'PATCH', body)).status, 404);
    assert.equal((await db.menuItem.findUnique({ where: { id: foreign.id } })).price, 1);
    const readPublic = async () => (await (await fetch(`${base}/public/tenants/demo-padang/menu`)).json()).data;
    assert.equal((await readPublic()).find(row => row.id === item.id).isAvailable, false);
    assert.ok(!(await readPublic()).some(row => row.id === foreign.id));
    assert.equal((await send(`${path}/${item.id}`, 'PATCH', { ...body, isActive: false })).status, 200);
    assert.ok(!(await readPublic()).some(row => row.id === item.id));
    await assert.rejects(db.menuItem.create({ data: { tenantId: tenant.id, name: 'Invalid probe', description: '', price: -1 } }));
  } finally {
    await db.operationalAudit.deleteMany({ where: { staffId: { in: accounts } } });
    await db.menuItem.deleteMany({ where: { id: { in: menus } } });
    await db.staffSession.deleteMany({ where: { staffId: { in: accounts } } });
    await db.staff.deleteMany({ where: { id: { in: accounts } } });
    await db.$disconnect(); await app.close();
  }
});
