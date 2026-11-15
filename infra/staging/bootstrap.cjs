'use strict';
const { randomBytes } = require('node:crypto');
const { constants, openSync, closeSync, fstatSync, lstatSync, writeFileSync, fsyncSync } = require('node:fs');

const directory = '/app/.local/staging-bootstrap';
const output = `${directory}/dashboard-accounts.json`;
const tenantId = '10000000-0000-4000-8000-000000000001';
const outletId = '20000000-0000-4000-8000-000000000001';
const slug = 'demo-padang';
const menu = [
  ['Rendang sapi', 'Daging sapi dimasak perlahan dengan santan dan rempah hingga empuk dan berbumbu pekat.', 35000, 'padang-rendang.webp'],
  ['Gulai ayam', 'Potongan ayam dalam kuah santan kuning dengan lengkuas, serai, dan daun jeruk.', 32000, 'padang-gulai.webp'],
  ['Dendeng balado', 'Irisan daging sapi tipis dengan sambal cabai merah dan bawang.', 38000, 'padang-dendeng.webp'],
  ['Ayam pop', 'Ayam lembut berbumbu bawang, disajikan dengan sambal merah terpisah.', 30000, 'ayam-pop.jpg'],
  ['Es jeruk', 'Perasan jeruk dengan es batu, segar sebagai pendamping hidangan berbumbu.', 15000, 'es-jeruk.jpg'],
  ['Es teh tawar', 'Seduhan teh tanpa gula dengan es batu.', 8000, 'es-teh.jpg'],
  ['Gulai kepala ikan', 'Kepala ikan dalam kuah santan berbumbu kunyit dan asam kandis.', 55000, 'gulai-kepala-ikan.jpg'],
  ['Nasi putih', 'Nasi putih hangat sebagai pendamping lauk dan sayur.', 8000, 'nasi.jpg'],
  ['Telur balado', 'Telur rebus dengan sambal cabai merah dan bawang yang ditumis.', 12000, 'telur-balado.jpg'],
].map(([name, description, price, imageKey], index) => ({ id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, tenantId, name, description, price, imageKey, isActive: true, isAvailable: true }));
const tables = [2, 4, 6, 12].map((capacity, index) => ({ id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, tenantId, outletId, name: `Meja ${index + 1}`, capacity, isActive: true }));
const staff = [
  { id: '50000000-0000-4000-8000-000000000001', tenantId, username: 'pemilik.sela', role: 'owner' },
  { id: '50000000-0000-4000-8000-000000000002', tenantId, username: 'operasional.sela', role: 'staff' },
];

function refuseExistingOutput() {
  try { lstatSync(output); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('Existing private output');
}

async function bootstrap() {
  if (process.env.ALLOW_STAGING_BOOTSTRAP !== '1' || process.env.NODE_ENV !== 'production' || process.getuid() !== 1000) throw new Error('Explicit production staging bootstrap required');
  const target = new URL(process.env.DATABASE_URL);
  if (target.protocol !== 'postgresql:' || target.hostname !== 'database' || target.port !== '5432' || target.pathname !== '/restaurant' || target.username !== 'restaurant_runtime' || !target.password || target.search || target.hash) throw new Error('Invalid staging target');
  const directoryFd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let db;
  try {
    const stat = fstatSync(directoryFd);
    if (!stat.isDirectory() || stat.uid !== 1000 || (stat.mode & 0o777) !== 0o700) throw new Error('Private output directory required');
    refuseExistingOutput();
    const { createDatabaseClient } = require('../../apps/api/dist/database/client.js');
    const { hashPassword } = require('../../apps/api/dist/auth/crypto.js');
    const { lockReservationTenant } = require('../../apps/api/dist/restaurant/reservation-lock.js');
    db = createDatabaseClient();
    await db.$transaction(async tx => {
      await lockReservationTenant(tx, tenantId);
      const [identity] = await tx.$queryRaw`SELECT current_user::text AS role, current_database()::text AS database`;
      if (identity?.role !== 'restaurant_runtime' || identity?.database !== 'restaurant') throw new Error('Unexpected database identity');
      refuseExistingOutput();
      if (await tx.tenant.findFirst({ where: { OR: [{ id: tenantId }, { slug }] }, select: { id: true } }) ||
          await tx.outlet.findFirst({ where: { OR: [{ id: outletId }, { tenantId }] }, select: { id: true } }) ||
          await tx.menuItem.findFirst({ where: { OR: [{ id: { in: menu.map(item => item.id) } }, { tenantId }] }, select: { id: true } }) ||
          await tx.diningTable.findFirst({ where: { OR: [{ id: { in: tables.map(table => table.id) } }, { tenantId }] }, select: { id: true } }) ||
          await tx.staff.findFirst({ where: { OR: [{ id: { in: staff.map(account => account.id) } }, { tenantId }] }, select: { id: true } })) throw new Error('Existing staging records');
      const accounts = [];
      for (const account of staff) {
        const password = randomBytes(24).toString('base64url');
        accounts.push({ ...account, password, passwordHash: await hashPassword(password) });
      }
      // Exclusive, durable private output precedes commit; failed/unknown commits require manual reconciliation.
      const fd = openSync(output, 'wx', 0o600);
      try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.uid !== 1000 || (stat.mode & 0o777) !== 0o600) throw new Error('Private output file required');
        writeFileSync(fd, JSON.stringify({ tenantSlug: slug, tenantId, outletId, accounts: accounts.map(({ username, role, password }) => ({ username, role, password })) }, null, 2) + '\n');
        fsyncSync(fd);
      } finally { closeSync(fd); }
      fsyncSync(directoryFd);
      await tx.tenant.create({ data: { id: tenantId, slug, name: 'Dapur Sela — Masakan Padang' } });
      await tx.outlet.create({ data: { id: outletId, tenantId, name: 'Dapur Sela Cikini', address: 'Jl. Sawo No. 18, Cikini, Jakarta Pusat (alamat sintetis untuk staging)', contactPhone: '', timezone: 'Asia/Jakarta', durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, cancelCutoffMinutes: 120, maxPartySize: 12 } });
      await tx.menuItem.createMany({ data: menu });
      await tx.weeklyHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId, outletId, weekday, openMinute: 600, closeMinute: 1320 })) });
      await tx.diningTable.createMany({ data: tables });
      for (const { password, ...account } of accounts) await tx.staff.create({ data: account });
    }, { maxWait: 5000, timeout: 30000 });
    console.info('Staging bootstrap committed. Open dashboard-accounts.json privately in the owner-only output directory; never share or commit it.');
  } finally {
    closeSync(directoryFd);
    if (db) await db.$disconnect();
  }
}

bootstrap().catch(() => {
  console.error('Staging bootstrap stopped; details suppressed. Existing output/accounts are never overwritten. Keep any output file: commit may have failed or succeeded. Operator must reconcile database and private output before any retry; never delete output blindly.');
  process.exitCode = 1;
});
