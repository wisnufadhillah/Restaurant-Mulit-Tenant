const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const vm = require('node:vm');

const source = readFileSync(resolve(__dirname, 'bootstrap.cjs'), 'utf8');
const directory = '/app/.local/staging-bootstrap';
const output = `${directory}/dashboard-accounts.json`;

async function run(options = {}) {
  const events = [], logs = [], rows = {}, hashes = [], randomSizes = [], modules = [];
  let file = options.existingOutput || false;
  let content;
  let dbCreated = false;
  const url = new URL('postgresql://restaurant_runtime@database:5432/restaurant');
  url.password = randomBytes(24).toString('hex');
  const process = { env: { DATABASE_URL: url.href, NODE_ENV: 'production', ALLOW_STAGING_BOOTSTRAP: '1', ...options.env }, getuid: () => options.uid ?? 1000 };
  const stat = (isDirectory, mode) => ({ uid: options.owner ?? 1000, mode, isDirectory: () => isDirectory, isFile: () => !isDirectory });
  const fs = {
    constants: { O_RDONLY: 0, O_DIRECTORY: 65536, O_NOFOLLOW: 131072 },
    openSync(path, flag, mode) {
      if (path === directory) {
        assert.equal(flag, 65536 | 131072);
        return 1;
      }
      assert.equal(path, output);
      assert.equal(flag, 'wx');
      assert.equal(mode, 0o600);
      if (file) throw new Error('Exclusive output collision');
      file = true;
      events.push('open-output');
      return 2;
    },
    fstatSync: fd => stat(fd === 1, fd === 1 ? options.directoryMode ?? 0o700 : 0o600),
    lstatSync() { if (file) return {}; throw Object.assign(new Error('Absent'), { code: 'ENOENT' }); },
    writeFileSync(fd, value) { assert.equal(fd, 2); if (options.writeFailure) throw new Error('Write failed'); content = JSON.parse(value); events.push('write-output'); },
    fsyncSync(fd) { events.push(fd === 1 ? 'sync-directory' : 'sync-output'); if (options.syncFailure) throw new Error('Sync failed'); },
    closeSync: () => {},
  };
  const tx = {
    $queryRaw: async () => [{ role: options.role ?? 'restaurant_runtime', database: options.database ?? 'restaurant' }],
  };
  for (const name of ['tenant', 'outlet', 'menuItem', 'diningTable', 'staff', 'weeklyHours']) tx[name] = {
    findFirst: async query => { events.push(`check-${name}`); assert.ok(query.where.OR.length > 0); return options.collision === name ? { id: 'existing' } : null; },
    create: async ({ data }) => { events.push(`create-${name}`); if (options.createFailure) throw new Error('Create failed'); (rows[name] ??= []).push(data); },
    createMany: async ({ data }) => { events.push(`create-${name}`); rows[name] = data; },
  };
  const db = {
    $transaction: async (callback, config) => {
      assert.equal(config.timeout, 30000);
      assert.equal(config.maxWait, 5000);
      events.push('begin');
      try { await callback(tx); if (options.commitFailure) throw new Error('Commit outcome unknown'); events.push('commit'); }
      catch (error) { events.push('rollback-or-unknown'); throw error; }
    },
    $disconnect: async () => events.push('disconnect'),
  };
  let pending;
  vm.runInNewContext(source.replace('bootstrap().catch(', 'pending = bootstrap().catch('), {
    process, URL, pending,
    console: { info: message => logs.push(message), error: message => logs.push(message) },
    require(name) {
      modules.push(name);
      if (name === 'node:fs') return fs;
      if (name === 'node:crypto') return { randomBytes(size) { randomSizes.push(size); return randomBytes(size); } };
      if (name === '../../apps/api/dist/database/client.js') return { createDatabaseClient() { dbCreated = true; return db; } };
      if (name === '../../apps/api/dist/auth/crypto.js') return { hashPassword: async password => { hashes.push(password); return `hashed-${hashes.length}`; } };
      if (name === '../../apps/api/dist/restaurant/reservation-lock.js') return { lockReservationTenant: async (client, id) => { assert.equal(client, tx); assert.equal(id, '10000000-0000-4000-8000-000000000001'); events.push('lock'); } };
      throw new Error('Unexpected import');
    },
    set pending(value) { pending = value; },
    get pending() { return pending; },
  });
  await pending;
  for (const password of hashes) assert.ok(!logs.join('\n').includes(password), 'Password excluded from logs');
  assert.ok(!logs.join('\n').includes(url.href), 'Connection URL excluded from logs');
  return { events, logs, rows, hashes, randomSizes, modules, file, content, dbCreated, process };
}

test('bootstrap creates one synthetic catalogue using existing hash and tenant-lock helpers, durable output before commit', async () => {
  const result = await run();
  assert.equal(result.process.exitCode, undefined);
  assert.equal(result.events[1], 'lock');
  for (const name of ['tenant', 'outlet', 'menuItem', 'diningTable', 'staff']) assert.ok(result.events.indexOf(`check-${name}`) < result.events.indexOf('open-output'));
  assert.ok(result.events.indexOf('sync-output') < result.events.indexOf('sync-directory'));
  assert.ok(result.events.indexOf('sync-directory') < result.events.indexOf('create-tenant'));
  assert.ok(result.events.indexOf('create-staff') < result.events.indexOf('commit'));
  assert.deepEqual(result.randomSizes, [24, 24]);
  assert.equal(result.hashes.length, 2);
  assert.equal(result.rows.tenant.length, 1);
  assert.equal(result.rows.tenant[0].slug, 'demo-padang');
  assert.equal(result.rows.outlet.length, 1);
  assert.equal(result.rows.outlet[0].contactPhone, '');
  assert.equal(result.rows.menuItem.length, 9);
  assert.equal(result.rows.weeklyHours.length, 7);
  assert.deepEqual(Array.from(result.rows.weeklyHours, row => row.weekday), [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(result.rows.weeklyHours.every(row => row.openMinute === 600 && row.closeMinute === 1320));
  assert.deepEqual(Array.from(result.rows.diningTable, row => row.capacity), [2, 4, 6, 12]);
  assert.deepEqual(Array.from(result.rows.staff, row => row.username), ['pemilik.sela', 'operasional.sela']);
  assert.deepEqual(Array.from(result.rows.staff, row => row.role), ['owner', 'staff']);
  for (const [index, account] of result.content.accounts.entries()) {
    assert.ok(account.password === result.hashes[index]);
    assert.equal(Buffer.from(account.password, 'base64url').length, 24);
    assert.equal(result.rows.staff[index].passwordHash, `hashed-${index + 1}`);
    assert.equal(Object.hasOwn(result.rows.staff[index], 'password'), false);
    assert.equal(Object.hasOwn(account, 'passwordHash'), false);
  }
  const images = readFileSync(resolve(__dirname, '../../apps/api/src/menu/menu-images.ts'), 'utf8');
  for (const item of result.rows.menuItem) assert.ok(images.includes(`key: "${item.imageKey}"`));
  assert.deepEqual(Object.keys(result.rows).sort(), ['diningTable', 'menuItem', 'outlet', 'staff', 'tenant', 'weeklyHours']);
});

test('bootstrap rejects missing opt-in, nonproduction, wrong runtime identity and any different URL context before DB', async () => {
  const cases = [
    { env: { ALLOW_STAGING_BOOTSTRAP: undefined } }, { env: { ALLOW_STAGING_BOOTSTRAP: 'true' } },
    { env: { NODE_ENV: 'development' } }, { uid: 0 }, { owner: 0 }, { directoryMode: 0o755 },
  ];
  const target = new URL('postgresql://restaurant_runtime@database:5432/restaurant');
  target.password = randomBytes(24).toString('hex');
  for (const [key, value] of [['hostname', '127.0.0.1'], ['port', '1'], ['pathname', '/other'], ['username', 'restaurant'], ['search', '?schema=other'], ['hash', '#other'], ['password', '']]) {
    const altered = new URL(target);
    altered[key] = value;
    cases.push({ env: { DATABASE_URL: altered.href } });
  }
  cases.push({ env: { DATABASE_URL: target.href.replace('postgresql:', 'http:') } });
  for (const options of cases) {
    const result = await run(options);
    assert.equal(result.process.exitCode, 1);
    assert.equal(result.dbCreated, false);
    assert.equal(result.file, false);
  }
});

test('bootstrap refuses existing private output and stable resource collisions without overwrite or rotation', async () => {
  const existing = await run({ existingOutput: true });
  assert.equal(existing.dbCreated, false);
  assert.equal(existing.hashes.length, 0);
  assert.ok(existing.logs[0].includes('reconcile'));
  for (const collision of ['tenant', 'outlet', 'menuItem', 'diningTable', 'staff']) {
    const result = await run({ collision });
    assert.equal(result.process.exitCode, 1);
    assert.equal(result.file, false);
    assert.equal(result.hashes.length, 0);
    assert.equal(Object.keys(result.rows).length, 0);
    assert.ok(result.events.includes('rollback-or-unknown'));
  }
});

test('bootstrap confirms actual DB role/database and retains private output on every post-create failure', async () => {
  for (const options of [{ role: 'restaurant' }, { database: 'other' }]) {
    const result = await run(options);
    assert.equal(result.process.exitCode, 1);
    assert.equal(result.file, false);
  }
  for (const options of [{ writeFailure: true }, { syncFailure: true }, { createFailure: true }, { commitFailure: true }]) {
    const result = await run(options);
    assert.equal(result.process.exitCode, 1);
    assert.equal(result.file, true);
    assert.ok(result.events.includes('rollback-or-unknown'));
    assert.equal(result.events.includes('commit'), false);
    assert.ok(result.logs[0].includes('never delete output blindly'));
  }
});

test('bootstrap service is explicit tools-only runtime DML with private bind output and no unrelated secret or published port', () => {
  const compose = readFileSync(resolve(__dirname, '../../compose.staging.yaml'), 'utf8').replace(/\r\n/g, '\n');
  const service = compose.split('\n  bootstrap:')[1].split('\n  migrate:')[0];
  assert.ok(service.includes('profiles: [tools]'));
  assert.ok(service.includes('command: [bootstrap]'));
  assert.ok(service.includes('NODE_ENV: production'));
  assert.ok(service.includes('ALLOW_STAGING_BOOTSTRAP: ""'));
  assert.ok(service.includes('secrets: [database_runtime_password]'));
  assert.ok(service.includes('source: ./.local/staging/bootstrap-output'));
  assert.ok(service.includes('target: /app/.local/staging-bootstrap'));
  assert.ok(service.includes('create_host_path: false'));
  assert.equal(/ports:|postgres_password|MIDTRANS|OPENROUTER|STAFF_ORIGIN|build:|privileged:/.test(service), false);
  const dockerfile = readFileSync(resolve(__dirname, 'api.Dockerfile'), 'utf8');
  assert.ok(dockerfile.includes('COPY infra/staging/bootstrap.cjs /app/infra/staging/bootstrap.cjs'));
  assert.ok(dockerfile.includes('USER node'));
});
