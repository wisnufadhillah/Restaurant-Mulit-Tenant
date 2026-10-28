const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabaseClient } = require('../dist/database/client');
const { TableService } = require('../dist/restaurant/table.service');
test('table persistence rejects cross-tenant outlet and invalid capacity; scopes updates', async () => {
  const db = createDatabaseClient(), service = new TableService();
  let id;
  try {
    const a = await db.tenant.findUniqueOrThrow({ where: { slug: 'demo-padang' } });
    const b = await db.tenant.findUniqueOrThrow({ where: { slug: 'demo-keluarga' } });
    const outlet = await db.outlet.findFirstOrThrow({ where: { tenantId: a.id } });
    const result = await service.save(a.id, { name: `Probe-${Date.now()}`, capacity: 4, isActive: true });
    id = result.data.id;
    await assert.rejects(service.save(b.id, { name: 'Foreign', capacity: 2, isActive: false }, id), error => error.getStatus() === 404);
    assert.equal((await db.diningTable.findUnique({ where: { id } })).capacity, 4);
    await assert.rejects(db.diningTable.create({ data: { tenantId: b.id, outletId: outlet.id, name: 'Foreign probe', capacity: 2 } }));
    await assert.rejects(db.diningTable.create({ data: { tenantId: a.id, outletId: outlet.id, name: 'Invalid probe', capacity: 0 } }));
    assert.ok(!(await service.list(b.id)).data.some(row => row.id === id));
  } finally { if (id) await db.diningTable.delete({ where: { id } }); await db.$disconnect(); await service.onModuleDestroy(); }
});
