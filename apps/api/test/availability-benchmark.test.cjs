const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { AvailabilityRepository } = require('../dist/restaurant/availability.repository');
const { AvailabilityService } = require('../dist/restaurant/availability.service');

test('availability benchmark: 20 tables and 1000 confirmed reservations per tenant sustain p95 < 50ms', { timeout: 60000 }, async () => {
  assert.equal(process.env.ALLOW_LOCAL_BENCHMARK_WRITES, '1', 'Explicit local benchmark write approval required');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && ['15432', '55432'].includes(target.port) && target.pathname === '/restaurant', 'Only approved local database permitted');

  const db = createDatabaseClient();
  const repo = new AvailabilityRepository();
  const service = new AvailabilityService(repo);

  let tenantId, outletId;
  const tableIds = [];
  const slug = `benchmark-${randomBytes(6).toString('hex')}`;

  try {
    // 1. Setup isolated tenant & outlet with valid 90-minute policy
    const tenant = await db.tenant.create({
      data: { slug, name: 'Synthetic Benchmark Restaurant' },
    });
    tenantId = tenant.id;

    const outlet = await db.outlet.create({
      data: {
        tenantId,
        name: 'Benchmark Outlet',
        address: 'Jl. Uji Performa No. 1, Jakarta',
        contactPhone: '',
        timezone: 'Asia/Jakarta',
        durationMinutes: 90,
        minNoticeMinutes: 60,
        maxAdvanceDays: 30,
        cancelCutoffMinutes: 120,
        maxPartySize: 12,
      },
    });
    outletId = outlet.id;

    // 2. Setup 7 days of weekly operating hours (00:00 to 24:00)
    await db.weeklyHours.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        tenantId,
        outletId,
        weekday,
        openMinute: 0,
        closeMinute: 1440,
      })),
    });

    // 3. Create exactly 20 tables with varied capacities:
    //    6x 2-pax, 8x 4-pax, 4x 6-pax, 2x 8-pax
    const tableCapacities = [
      2, 2, 2, 2, 2, 2,
      4, 4, 4, 4, 4, 4, 4, 4,
      6, 6, 6, 6,
      8, 8,
    ];
    assert.equal(tableCapacities.length, 20);

    for (let i = 0; i < tableCapacities.length; i++) {
      const table = await db.diningTable.create({
        data: {
          tenantId,
          outletId,
          name: `Meja ${String(i + 1).padStart(2, '0')}`,
          capacity: tableCapacities[i],
          isActive: true,
        },
      });
      tableIds.push(table.id);
    }
    assert.equal(tableIds.length, 20);

    // 4. Generate 1,000 non-overlapping confirmed reservations across the 20 tables
    //    8 non-overlapping 90m slots per day (10:00 to 22:00 WIB):
    //    10:00, 11:30, 13:00, 14:30, 16:00, 17:30, 19:00, 20:30
    const slotMinutes = [600, 690, 780, 870, 960, 1050, 1140, 1230];
    const reservationsToInsert = [];
    const now = new Date();
    const baseDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));

    let createdCount = 0;
    for (let dayOffset = 0; createdCount < 1000; dayOffset++) {
      const dayDate = new Date(baseDay.getTime() + dayOffset * 86400000);
      for (const startMin of slotMinutes) {
        if (createdCount >= 1000) break;
        for (const tableId of tableIds) {
          if (createdCount >= 1000) break;
          // WIB is UTC+7 -> minute offset from UTC midnight is startMin - 420
          const startAt = new Date(dayDate.getTime() + (startMin - 420) * 60000);
          const endAt = new Date(startAt.getTime() + 90 * 60000);
          const id = randomUUID();
          const tokenHash = randomBytes(32).toString('hex');
          reservationsToInsert.push({
            id,
            tenantId,
            outletId,
            tableId,
            referenceCode: `BMK-${createdCount + 1}`,
            managementTokenHash: tokenHash,
            managementExpiresAt: new Date(endAt.getTime() + 86400000),
            guestName: `Tamu Uji ${createdCount + 1}`,
            guestPhone: '081200000000',
            startAt,
            endAt,
            partySize: 2,
            status: 'confirmed',
            source: 'web',
            idempotencyKey: `bmk-key-${id}`,
            requestHash: tokenHash,
          });
          createdCount++;
        }
      }
    }

    assert.equal(reservationsToInsert.length, 1000);
    // Batch insert 1,000 rows
    const inserted = await db.reservation.createMany({ data: reservationsToInsert });
    assert.equal(inserted.count, 1000);

    // Verify row counts
    const reservationCount = await db.reservation.count({ where: { tenantId } });
    assert.equal(reservationCount, 1000);

    // 5. Verification: Correct availability calculation
    // Skenario A: Jam sibuk di hari yang terisi penuh (Hari H+2 jam 19:00 WIB)
    // Semua 20 meja terisi -> available = false
    const busyDate = baseDay.toISOString().slice(0, 10);
    const busyParams = new URLSearchParams({ date: busyDate, time: '19:00', partySize: '4' });
    const busyResult = await service.check(slug, busyParams);
    assert.equal(busyResult.data.available, false);
    assert.equal(busyResult.data.held, false);
    assert.ok(busyResult.data.reason);

    // Skenario B: Hari yang kosong (Hari H+15 jam 19:00 WIB)
    // Meja kosong -> available = true
    const freeDay = new Date(baseDay.getTime() + 15 * 86400000);
    const freeDate = freeDay.toISOString().slice(0, 10);
    const freeParams2 = new URLSearchParams({ date: freeDate, time: '19:00', partySize: '2' });
    const freeResult2 = await service.check(slug, freeParams2);
    assert.equal(freeResult2.data.available, true);
    assert.equal(freeResult2.data.held, false);

    const freeParams5 = new URLSearchParams({ date: freeDate, time: '19:00', partySize: '5' });
    const freeResult5 = await service.check(slug, freeParams5);
    assert.equal(freeResult5.data.available, true);

    // 6. Benchmark: 100 sequential availability checks across varying inputs
    const testCases = [
      { date: busyDate, time: '10:00', partySize: '2' },
      { date: busyDate, time: '13:00', partySize: '4' },
      { date: busyDate, time: '17:30', partySize: '6' },
      { date: busyDate, time: '19:00', partySize: '8' },
      { date: freeDate, time: '11:30', partySize: '2' },
      { date: freeDate, time: '14:30', partySize: '4' },
      { date: freeDate, time: '18:00', partySize: '5' },
      { date: freeDate, time: '20:30', partySize: '8' },
    ];

    // Warm-up 5 iterations
    for (let i = 0; i < 5; i++) {
      const tc = testCases[i % testCases.length];
      await service.check(slug, new URLSearchParams(tc));
    }

    const iterations = 100;
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
      const tc = testCases[i % testCases.length];
      const params = new URLSearchParams(tc);
      const t0 = performance.now();
      const res = await service.check(slug, params);
      const t1 = performance.now();
      assert.ok(typeof res.data.available === 'boolean');
      latencies.push(t1 - t0);
    }

    latencies.sort((a, b) => a - b);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const mean = sum / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.info(`\n=== AVAILABILITY BENCHMARK RESULTS (20 Tables, 1,000 Reservations) ===`);
    console.info(`Total Queries: ${iterations}`);
    console.info(`Min:           ${min.toFixed(2)} ms`);
    console.info(`Mean:          ${mean.toFixed(2)} ms`);
    console.info(`p50 (Median):  ${p50.toFixed(2)} ms`);
    console.info(`p95:           ${p95.toFixed(2)} ms`);
    console.info(`p99:           ${p99.toFixed(2)} ms`);
    console.info(`Max:           ${max.toFixed(2)} ms`);
    console.info(`====================================================================\n`);

    // SLA assertion: p95 must be < 50ms
    assert.ok(p95 < 50, `p95 latency (${p95.toFixed(2)}ms) must be below 50ms threshold`);
  } finally {
    // 7. Cleanup benchmark fixtures completely
    try {
      await repo.onModuleDestroy();
    } catch { /* ignore */ }

    if (tenantId) {
      await db.$transaction(async tx => {
        const where = { tenantId };
        await tx.reservation.deleteMany({ where });
        await tx.weeklyHours.deleteMany({ where });
        await tx.diningTable.deleteMany({ where });
        await tx.outlet.deleteMany({ where });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
      const remaining = await db.tenant.count({ where: { id: tenantId } });
      assert.equal(remaining, 0, 'Benchmark tenant fixture must be completely removed');
    }
    await db.$disconnect();
  }
});
