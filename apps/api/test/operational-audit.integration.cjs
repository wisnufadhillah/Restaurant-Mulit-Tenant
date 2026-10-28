const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { MenuService } = require('../dist/menu/menu.service');
const { TableService } = require('../dist/restaurant/table.service');
const { HoursService } = require('../dist/restaurant/hours.service');
const { ProfileService } = require('../dist/restaurant/profile.controller');

test('audit actor FK failure rolls back every operational mutation', async () => {
  const db = createDatabaseClient(), menu = new MenuService(), tables = new TableService(), hours = new HoursService(), profile = new ProfileService();
  let tenant;
  try {
    tenant = await db.tenant.create({ data: { slug: `audit-${randomUUID()}`, name: 'Synthetic original' } });
    await db.outlet.create({ data: { tenantId: tenant.id, name: 'Synthetic original', address: 'Synthetic', contactPhone: '' } });
    const invalidActor = randomUUID();
    const body = { name: 'Synthetic menu', description: '', price: 100, isActive: true, isAvailable: true };
    const item = await menu.create(tenant.id, body);
    await assert.rejects(menu.create(tenant.id, { ...body, name: 'Rejected create' }, invalidActor));
    assert.equal(await db.menuItem.count({ where: { tenantId: tenant.id } }), 1);
    await assert.rejects(menu.update(tenant.id, item.data.id, { ...body, price: 200 }, false, invalidActor));
    await assert.rejects(menu.update(tenant.id, item.data.id, { isAvailable: false }, true, invalidActor));
    const unchanged = await db.menuItem.findUniqueOrThrow({ where: { id: item.data.id } });
    assert.equal(unchanged.price, 100); assert.equal(unchanged.isAvailable, true);
    await assert.rejects(tables.save(tenant.id, { name: 'M01', capacity: 4, isActive: true }, undefined, invalidActor));
    assert.equal(await db.diningTable.count({ where: { tenantId: tenant.id } }), 0);
    await assert.rejects(hours.save(tenant.id, { weekday: 1, openMinute: 660, closeMinute: 1260 }, invalidActor));
    assert.equal(await db.weeklyHours.count({ where: { tenantId: tenant.id } }), 0);
    await assert.rejects(profile.save(tenant.id, { name: 'Rejected profile', outletName: 'Rejected outlet', address: 'Synthetic changed', contactPhone: '' }, invalidActor));
    assert.equal((await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).name, 'Synthetic original');
    assert.equal(await db.operationalAudit.count({ where: { tenantId: tenant.id } }), 0);
  } finally {
    if (tenant) {
      const where = { tenantId: tenant.id };
      await db.operationalAudit.deleteMany({ where }); await db.menuItem.deleteMany({ where }); await db.diningTable.deleteMany({ where }); await db.weeklyHours.deleteMany({ where }); await db.outlet.deleteMany({ where }); await db.tenant.delete({ where: { id: tenant.id } });
    }
    await Promise.all([db.$disconnect(), menu.onModuleDestroy(), tables.onModuleDestroy(), hours.onModuleDestroy(), profile.onModuleDestroy()]);
  }
});
