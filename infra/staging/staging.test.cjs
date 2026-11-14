const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
const vm = require('node:vm');

function wrapper(mode, overrides = {}) {
  const value = `${randomBytes(32).toString('hex')}:@/%?#[]`;
  const names = ['POSTGRES_PASSWORD', 'DATABASE_RUNTIME_PASSWORD', 'ASSISTANT_GATEWAY_TOKEN', 'INTERNAL_TOOL_SERVICE_TOKEN', 'INTERNAL_CONTEXT_SECRET', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_SIGNATURE_SECRET'];
  const signatureSecret = randomBytes(32).toString('hex');
  const env = Object.fromEntries(names.map(name => [`${name}_FILE`, `/run/secrets/${name.toLowerCase()}`]));
  Object.assign(env, { STAFF_ORIGIN: 'https://frontend.example.invalid', API_ALLOWED_ORIGINS: 'https://frontend.example.invalid', MIDTRANS_IS_PRODUCTION: 'false' }, overrides);
  const calls = [], errors = [], filesRead = [];
  const process = { argv: ['node', 'entrypoint', mode], env, execPath: '/usr/local/bin/node', on: () => {} };
  vm.runInNewContext(readFileSync(resolve(__dirname, 'api-entrypoint.cjs'), 'utf8'), {
    URL, encodeURIComponent, process, console: { error: value => errors.push(value) },
    require: name => name === 'node:fs' ? { readFileSync: path => { filesRead.push(path); return `${path.endsWith('midtrans_signature_secret') ? signatureSecret : value}\n`; } } : {
      spawn: (binary, args, options) => { calls.push({ binary, args, options }); return { on: () => {}, kill: () => {} }; },
    },
  });
  return { value, signatureSecret, calls, errors, process, filesRead };
}

test('API wrapper encodes mounted database password and never passes secrets in arguments', () => {
  for (const mode of ['serve', 'migrate']) {
    const { value, calls, errors } = wrapper(mode);
    assert.equal(errors.length, 0);
    assert.equal(calls.length, 1);
    const url = new URL(calls[0].options.env.DATABASE_URL);
    assert.ok(decodeURIComponent(url.password) === value);
    assert.equal(url.hostname, 'database');
    assert.equal(url.username, mode === 'serve' ? 'restaurant_runtime' : 'restaurant');
    assert.equal(url.port, '5432');
    assert.equal(calls[0].args.join(' ').includes(value), false);
    assert.equal(calls[0].args.includes('deploy'), mode === 'migrate');
  }
});

test('API wrapper fails closed on invalid origin, live payment or secret path without logging values', () => {
  for (const override of [{ STAFF_ORIGIN: 'http://frontend.example.invalid' }, { API_ALLOWED_ORIGINS: '*' }, { MIDTRANS_IS_PRODUCTION: 'true' }, { DATABASE_RUNTIME_PASSWORD_FILE: '/outside/secret' }, { PAYMENTS_ENABLED: '' }, { PAYMENTS_ENABLED: 'FALSE' }, { PAYMENTS_ENABLED: '0' }]) {
    const { calls, errors, process } = wrapper('serve', override);
    assert.equal(calls.length, 0);
    assert.equal(process.exitCode, 1);
    assert.deepEqual(errors, ['Staging configuration invalid; details suppressed']);
  }
});

test('disabled API wrapper skips both Midtrans files and strips inherited credentials', () => {
  const { calls, errors, filesRead } = wrapper('serve', { PAYMENTS_ENABLED: 'false', MIDTRANS_SERVER_KEY: randomBytes(32).toString('hex'), MIDTRANS_SIGNATURE_SECRET: randomBytes(32).toString('hex'), MIDTRANS_SERVER_KEY_FILE: '/outside/unreadable', MIDTRANS_SIGNATURE_SECRET_FILE: '/outside/unreadable' });
  assert.equal(errors.length, 0);
  assert.equal(calls.length, 1);
  for (const name of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_SIGNATURE_SECRET']) assert.equal(Object.hasOwn(calls[0].options.env, name), false);
  assert.equal(filesRead.some(path => path.includes('midtrans') || path.includes('unreadable')), false);
  assert.equal(filesRead.length, 4);
  for (const flag of [undefined, 'true']) {
    const enabled = wrapper('serve', { PAYMENTS_ENABLED: flag });
    assert.equal(enabled.calls.length, 1);
    assert.ok(enabled.filesRead.includes('/run/secrets/midtrans_server_key'));
    assert.ok(enabled.filesRead.includes('/run/secrets/midtrans_signature_secret'));
    assert.equal(enabled.calls[0].options.env.MIDTRANS_SERVER_KEY, enabled.value);
    assert.equal(enabled.calls[0].options.env.MIDTRANS_SIGNATURE_SECRET, enabled.signatureSecret);
    assert.notEqual(enabled.value, enabled.signatureSecret);
  }
});

test('enabled wrapper requires both credential files even with inherited values', () => {
  for (const flag of [undefined, 'true']) for (const name of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_SIGNATURE_SECRET']) {
    for (const path of [undefined, '', '/outside/unreadable']) {
      const result = wrapper('serve', { PAYMENTS_ENABLED: flag, [name]: randomBytes(32).toString('hex'), [`${name}_FILE`]: path });
      assert.equal(result.calls.length, 0);
      assert.equal(result.process.exitCode, 1);
      assert.deepEqual(result.errors, ['Staging configuration invalid; details suppressed']);
    }
  }
});

test('staging enables sandbox and mounts both distinct credential files only into API', () => {
  const compose = readFileSync(resolve(__dirname, '../../compose.staging.yaml'), 'utf8');
  const runtime = compose.split('\n  api:')[1].split('\n  assistant:')[0];
  assert.ok(runtime.includes('PAYMENTS_ENABLED: "true"'));
  assert.ok(runtime.includes('MIDTRANS_IS_PRODUCTION: "false"'));
  for (const name of ['midtrans_server_key', 'midtrans_signature_secret']) {
    assert.ok(runtime.includes(`${name.toUpperCase()}_FILE: /run/secrets/${name}`));
    assert.ok(runtime.match(/secrets: \[([^\]]+)\]/)[1].split(', ').includes(name));
    assert.ok(compose.replace(/\r\n/g, '\n').includes(`  ${name}:\n    file: ./.local/staging/${name}`));
    assert.equal(compose.split('\n  assistant:')[1].split('\nsecrets:')[0].includes(name), false);
  }
});

test('runtime service never receives the administrator database secret', () => {
  const compose = readFileSync(resolve(__dirname, '../../compose.staging.yaml'), 'utf8');
  const runtime = compose.split('\n  api:')[1].split('\n  assistant:')[0];
  const migration = compose.split('\n  migrate:')[1].split('\nnetworks:')[0];
  assert.ok(runtime.includes('DATABASE_RUNTIME_PASSWORD_FILE:'));
  assert.equal(runtime.includes('POSTGRES_PASSWORD_FILE:'), false);
  assert.equal(runtime.includes('secrets: [postgres_password'), false);
  assert.ok(migration.includes('POSTGRES_PASSWORD_FILE:'));
});

test('edge route allowlist exposes current business routes but not internal, schema or dev paths', () => {
  const caddy = readFileSync(resolve(__dirname, 'Caddyfile'), 'utf8');
  const regexp = new RegExp(caddy.match(/path_regexp routes (.+)/)[1]);
  for (const path of [
    '/api/v1/health', '/api/v1/public/tenants/demo-padang/restaurant',
    '/api/v1/public/tenants/demo-padang/menu/images/upload-abc.webp',
    '/api/v1/public/tenants/demo-padang/reservations/management-session/logout',
    '/api/v1/staff/login', '/api/v1/staff/tenants/demo-padang/menu/images',
    '/api/v1/staff/tenants/demo-padang/menu/id/availability',
    '/api/v1/staff/tenants/demo-padang/reservations/id/transitions',
    '/api/v1/staff/tenants/demo-padang/special-hours/2026-01-01',
    '/api/v1/chat/session', '/api/v1/chat/messages', '/api/v1/chat/catalogue/menu',
    '/api/v1/chat/orders/capabilities', '/api/v1/chat/orders/notification', '/api/v1/chat/orders/id/status',
  ]) assert.ok(regexp.test(path), path);
  for (const path of ['/docs', '/openapi.json', '/api/v1/internal/tenants/demo-padang/menu', '/turn', '/health', '/v2/chat', '/api/v1/dev', '/api/v1/chat/catalogue/unknown', '/api/v1/staff/demo-padang/menu/id', '/api/v1/health/extra']) assert.equal(regexp.test(path), false, path);
});
