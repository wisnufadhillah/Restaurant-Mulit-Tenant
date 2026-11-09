const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { EventEmitter, once } = require('node:events');
const vm = require('node:vm');

const source = readFileSync(resolve(__dirname, 'reservation-browser.integration.cjs'), 'utf8').replace(/\r\n/g, '\n');
const start = source.lastIndexOf('  } finally {');
const end = source.lastIndexOf('\n  }\n});');
assert.ok(start > 0 && end > start, 'Actual integration cleanup block must exist');
const cleanupSource = source.slice(start + '  } finally {'.length, end);

async function boundary({ hungBrowser = false, spawnFailed = false, shutdownFails = false, tenantId = 'synthetic-tenant' } = {}) {
  const calls = [];
  const child = new EventEmitter();
  child.pid = spawnFailed ? undefined : 12345;
  child.exitCode = null;
  const context = {
    assert, once, AggregateError, Error, Promise,
    process: { platform: 'win32', env: { STAFF_ORIGIN: 'synthetic-current' } },
    previousOrigin: 'synthetic-original', tenantId, child, spawnFailed,
    generatedConfig: [{ path: 'synthetic-config', content: Buffer.from('original') }],
    writeFileSync: () => calls.push('config'),
    setTimeout: callback => setTimeout(callback, 5), clearTimeout,
    browser: { contexts: () => [{ pages: () => [{ unrouteAll: async () => { calls.push('routes'); } }] }], close: async () => { calls.push('browser'); if (hungBrowser) await new Promise(() => {}); } },
    app: { close: async () => { calls.push('api'); } },
    spawn: () => {
      calls.push('taskkill');
      const stop = new EventEmitter();
      queueMicrotask(() => {
        stop.emit('exit', shutdownFails ? 1 : 0);
        if (!shutdownFails) { child.exitCode = 0; child.emit('exit', 0); }
      });
      return stop;
    },
    db: {
      $transaction: async run => {
        calls.push('fixtures');
        const models = ['reservationManagementSession', 'reservationConfirmation', 'reservationEvent', 'reservation', 'reservationCreatorSession', 'weeklyHours', 'diningTable', 'outlet', 'tenant'];
        const tx = Object.fromEntries(models.map(name => [name, { deleteMany: async ({ where }) => { assert.deepEqual(Object.values(where), ['synthetic-tenant']); } }]));
        await run(tx);
      },
      tenant: { count: async ({ where }) => { calls.push('count'); assert.equal(where.id, 'synthetic-tenant'); return 0; } },
      $disconnect: async () => { calls.push('disconnect'); },
    },
  };
  let failure;
  try { await vm.runInNewContext(`(async () => {${cleanupSource}\n})()`, context); }
  catch (error) { failure = error; }
  return { calls, failure, environment: context.process.env };
}

test('hung browser cleanup reaches deadline and attempts server, fixture and environment cleanup', async () => {
  const result = await boundary({ hungBrowser: true });
  assert.ok(result.failure instanceof AggregateError);
  for (const stage of ['taskkill', 'config', 'api', 'fixtures', 'disconnect']) assert.ok(result.calls.includes(stage), stage);
  assert.equal(result.environment.STAFF_ORIGIN, 'synthetic-original');
});

test('failed spawn without PID avoids process kill and still restores fixture and environment', async () => {
  const result = await boundary({ spawnFailed: true });
  assert.equal(result.failure, undefined);
  assert.ok(!result.calls.includes('taskkill'));
  assert.ok(result.calls.includes('config'));
  assert.ok(result.calls.includes('fixtures'));
  assert.equal(result.environment.STAFF_ORIGIN, 'synthetic-original');
});

test('unconfirmed shutdown preserves configuration while attempting later cleanup', async () => {
  const result = await boundary({ shutdownFails: true });
  assert.ok(result.failure instanceof AggregateError);
  assert.ok(!result.calls.includes('config'));
  for (const stage of ['api', 'fixtures', 'disconnect']) assert.ok(result.calls.includes(stage), stage);
});

test('missing fixture never queries or deletes tenant data', async () => {
  const result = await boundary({ tenantId: null });
  assert.equal(result.failure, undefined);
  assert.ok(!result.calls.includes('fixtures'));
  assert.ok(!result.calls.includes('count'));
  assert.ok(result.calls.includes('disconnect'));
});
