const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { HoursService } = require('../dist/restaurant/hours.service');
test('weekly hours persist closed and open days with composite tenant scope and SQL interval checks', async () => {
  const db = createDatabaseClient(), service = new HoursService();
  let tenant;
  try {
    tenant = await db.tenant.create({ data: { slug: `hours-${randomUUID()}`, name: 'Synthetic hours tenant' } });
    const outlet = await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic', address: 'Synthetic', contactPhone: '' } });
    await service.save(tenant.id, { weekday: 1, openMinute: 660, closeMinute: 1260 });
    assert.equal((await service.list(tenant.id)).data[0].openMinute, 660);
    await service.save(tenant.id, { weekday: 1, openMinute: null, closeMinute: null });
    assert.equal((await service.list(tenant.id)).data[0].closeMinute, null);
    await assert.rejects(db.weeklyHours.create({ data: { tenantId: tenant.id, outletId: outlet.id, weekday: 2, openMinute: 1200, closeMinute: 600 } }));
    const other = await db.tenant.findUniqueOrThrow({ where: { slug: 'demo-padang' } });
    await assert.rejects(db.weeklyHours.create({ data: { tenantId: other.id, outletId: outlet.id, weekday: 2, openMinute: 600, closeMinute: 1200 } }));
  } finally {
    if (tenant) { await db.weeklyHours.deleteMany({ where: { tenantId: tenant.id } }); await db.outlet.deleteMany({ where: { tenantId: tenant.id } }); await db.tenant.delete({ where: { id: tenant.id } }); }
    await db.$disconnect(); await service.onModuleDestroy();
  }
});
