const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');

// All synthetic writes are contained in one transaction that is deliberately rolled back.
test('reservation storage enforces overlap, tenant keys and atomic event writes on local PostgreSQL', async () => {
  const { databaseUrl } = require('../dist/database/config');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant', 'Only the local synthetic database is permitted');
  const db = createDatabaseClient();
  const rollback = new Error('Synthetic transaction rollback');
  try {
    await assert.rejects(db.$transaction(async tx => {
      const first = randomUUID(), second = randomUUID(), outlet = randomUUID(), otherOutlet = randomUUID(), table = randomUUID(), otherTable = randomUUID();
      for (const tenant of [first, second]) await tx.$executeRaw`INSERT INTO tenants (id, slug, name, updated_at) VALUES (${tenant}::uuid, ${`storage-${tenant}`}, 'Synthetic restaurant', CURRENT_TIMESTAMP)`;
      for (const [tenant, location, desk] of [[first, outlet, table], [second, otherOutlet, otherTable]]) {
        await tx.$executeRaw`INSERT INTO outlets (id, tenant_id, name, address, contact_phone, updated_at) VALUES (${location}::uuid, ${tenant}::uuid, 'Synthetic outlet', 'Synthetic address', '', CURRENT_TIMESTAMP)`;
        await tx.$executeRaw`INSERT INTO dining_tables (id, tenant_id, outlet_id, name, capacity) VALUES (${desk}::uuid, ${tenant}::uuid, ${location}::uuid, 'Synthetic table', 4)`;
      }
      async function insert({ tenant = first, location = outlet, desk = table, start = '2026-11-10T03:00:00Z', end = '2026-11-10T04:30:00Z', status = 'confirmed', party = 4, key = randomUUID() } = {}) {
        const id = randomUUID(), hash = 'a'.repeat(64);
        await tx.$executeRaw`INSERT INTO reservations (id, tenant_id, outlet_id, table_id, reference_code, management_token_hash, management_expires_at, guest_name, guest_phone, start_at, end_at, party_size, status, source, idempotency_key, request_hash) VALUES (${id}::uuid, ${tenant}::uuid, ${location}::uuid, ${desk}::uuid, ${id}, ${hash}, ${new Date(new Date(end).getTime() + 3600000)}, 'Synthetic guest', '0000000000', ${new Date(start)}, ${new Date(end)}, ${party}, ${status}, 'web', ${key}, ${hash})`;
        return id;
      }
      async function rejectsCode(action, code) {
        await tx.$executeRawUnsafe('SAVEPOINT reservation_check');
        await assert.rejects(action, error => error.code === 'P2010' && error.meta?.driverAdapterError?.cause?.originalCode === code);
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT reservation_check');
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT reservation_check');
      }
      const reservation = await insert({ key: 'synthetic-retry' });
      await rejectsCode(() => insert(), '23P01');
      await insert({ start: '2026-11-10T04:30:00Z', end: '2026-11-10T06:00:00Z' });
      await insert({ status: 'cancelled' });
      await insert({ tenant: second, location: otherOutlet, desk: otherTable });
      await rejectsCode(() => insert({ desk: otherTable }), '23503');
      await rejectsCode(() => insert({ tenant: second }), '23503');
      await rejectsCode(() => insert({ status: 'pending' }), '23514');
      await rejectsCode(() => insert({ party: 0 }), '23514');
      await rejectsCode(() => insert({ end: '2026-11-10T04:00:00Z' }), '23514');
      await rejectsCode(() => insert({ status: 'cancelled', key: 'synthetic-retry' }), '23505');
      const event = randomUUID();
      await tx.$executeRaw`INSERT INTO reservation_events (id, tenant_id, reservation_id, to_status, actor_type) VALUES (${event}::uuid, ${first}::uuid, ${reservation}::uuid, 'confirmed', 'customer')`;
      await rejectsCode(() => tx.$executeRaw`INSERT INTO reservation_events (id, tenant_id, reservation_id, to_status, actor_type) VALUES (${randomUUID()}::uuid, ${second}::uuid, ${reservation}::uuid, 'confirmed', 'customer')`, '23503');
      const failedReservation = randomUUID();
      await rejectsCode(async () => {
        await tx.$executeRaw`INSERT INTO reservation_events (id, tenant_id, reservation_id, to_status, actor_type) VALUES (${failedReservation}::uuid, ${first}::uuid, ${reservation}::uuid, 'confirmed', 'customer')`;
        await insert();
      }, '23P01');
      const rows = await tx.$queryRaw`SELECT id FROM reservation_events WHERE id = ${failedReservation}::uuid`;
      assert.equal(rows.length, 0);
      throw rollback;
    }, { timeout: 30000 }), error => error === rollback);
  } finally { await db.$disconnect(); }
});
