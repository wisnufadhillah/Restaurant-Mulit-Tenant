const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { SpecialHoursService, specialInput } = require('../dist/restaurant/special-hours.service');
const { hashPassword, createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { createApp } = require('../dist/create-app');
test('special hours override weekly and audit failure rolls back schedule', async () => {
  const db = createDatabaseClient(), service = new SpecialHoursService(); let tenant;
  try {
    assert.throws(() => specialInput({ date: '2026-02-30', openMinute: null, closeMinute: null }));
    tenant = await db.tenant.create({ data: { slug: `special-${randomUUID()}`, name: 'Synthetic special hours' } });
    const outlet = await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic', address: 'Synthetic', contactPhone: '' } });
    const staff = await db.staff.create({ data: { tenantId: tenant.id, username: 'synthetic.owner', role: 'owner', passwordHash: await hashPassword(randomBytes(24).toString('base64url')) } });
    await db.weeklyHours.create({ data: { tenantId: tenant.id, outletId: outlet.id, weekday: 1, openMinute: 660, closeMinute: 1260 } });
    assert.equal((await service.resolve(tenant.id, '2026-11-02')).data.source, 'weekly');
    await service.save(tenant.id, staff.id, { date: '2026-11-02', openMinute: null, closeMinute: null });
    const closed = (await service.resolve(tenant.id, '2026-11-02')).data;
    assert.equal(closed.source, 'special'); assert.equal(closed.openMinute, null);
    assert.equal(await db.operationalAudit.count({ where: { tenantId: tenant.id, staffId: staff.id } }), 1);
    await assert.rejects(service.save(tenant.id, randomUUID(), { date: '2026-11-02', openMinute: 600, closeMinute: 1200 }));
    assert.equal((await service.resolve(tenant.id, '2026-11-02')).data.openMinute, null);
    assert.equal(await db.operationalAudit.count({ where: { tenantId: tenant.id } }), 1);
    assert.equal((await service.list(tenant.id)).data.length, 1);
    await service.remove(tenant.id, staff.id, '2026-11-02');
    assert.equal((await service.resolve(tenant.id, '2026-11-02')).data.source, 'weekly');
    assert.equal((await service.list(tenant.id)).data.length, 0);
    assert.equal(await db.operationalAudit.count({ where: { tenantId: tenant.id } }), 2);
    const app = await createApp();
    try {
      await app.listen(0, '127.0.0.1');
      const token = createSessionToken();
      await db.staffSession.create({ data: { tenantId: tenant.id, staffId: staff.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000) } });
      const base = `${await app.getUrl()}/api/v1/staff/tenants/${tenant.slug}/special-hours`;
      const send = (origin, body, cookie = `restaurant_staff=${token}`) => fetch(base, { method: 'PUT', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const payload = { date: '2026-11-02', openMinute: null, closeMinute: null };
      assert.equal((await send('http://127.0.0.1:3000', payload, '')).status, 401);
      assert.equal((await send('https://other.example', payload)).status, 403);
      assert.equal((await send('http://127.0.0.1:3000', { ...payload, staffId: staff.id })).status, 400);
      assert.equal((await send('http://127.0.0.1:3000', payload)).status, 200);
      await db.staff.update({ where: { id: staff.id }, data: { role: 'staff' } });
      assert.equal((await send('http://127.0.0.1:3000', payload)).status, 403);
      await db.staffSession.deleteMany({ where: { tenantId: tenant.id } });
    } finally { await app.close(); }
  } finally {
    if (tenant) { const where = { tenantId: tenant.id }; await db.operationalAudit.deleteMany({ where }); await db.specialHours.deleteMany({ where }); await db.weeklyHours.deleteMany({ where }); await db.staffSession.deleteMany({ where }); await db.staff.deleteMany({ where }); await db.outlet.deleteMany({ where }); await db.tenant.delete({ where: { id: tenant.id } }); }
    await db.$disconnect(); await service.onModuleDestroy();
  }
});
