const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabaseClient } = require('../dist/database/client.js');

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const outlet = '20000000-0000-4000-8000-000000000001';

test('local PostgreSQL connects and seeded outlets stay tenant scoped', async () => {
  const db = createDatabaseClient();
  try {
    const rows = await db.outlet.findMany({ where: { tenantId: first } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, outlet);
    assert.equal(await db.outlet.count({ where: { tenantId: second } }), 1);
    assert.equal(await db.outlet.count({ where: { tenantId: second, id: outlet } }), 0);
  } finally { await db.$disconnect(); }
});

test('composite outlet key rejects cross-tenant references and rolls back probe', async () => {
  const db = createDatabaseClient();
  try {
    await assert.rejects(db.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE TABLE outlet_reference_probe (tenant_id uuid NOT NULL, outlet_id uuid NOT NULL, FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id))');
      await tx.$executeRaw`INSERT INTO outlet_reference_probe VALUES (${first}::uuid, ${outlet}::uuid)`;
      await tx.$executeRaw`INSERT INTO outlet_reference_probe VALUES (${second}::uuid, ${outlet}::uuid)`;
    }), error => error.code === 'P2010' && error.meta?.driverAdapterError?.cause?.originalCode === '23503');
  } finally { await db.$disconnect(); }
});
