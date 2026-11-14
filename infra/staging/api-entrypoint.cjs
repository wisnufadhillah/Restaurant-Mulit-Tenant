'use strict';
const { readFileSync } = require('node:fs');
const { spawn } = require('node:child_process');

function secret(name, minimum = 1) {
  const path = process.env[`${name}_FILE`];
  if (!path || !/^\/run\/secrets\/[a-z_]+$/.test(path)) throw new Error('Missing secret file');
  const value = readFileSync(path, 'utf8').replace(/\r?\n$/, '');
  if (value.length < minimum || /[\r\n\0]/.test(value)) throw new Error('Invalid secret file');
  return value;
}

try {
  const mode = process.argv[2];
  if (!['serve', 'migrate'].includes(mode)) throw new Error('Invalid startup mode');
  const url = new URL('postgresql://database:5432/restaurant');
  url.username = mode === 'serve' ? 'restaurant_runtime' : 'restaurant';
  url.password = encodeURIComponent(secret(mode === 'serve' ? 'DATABASE_RUNTIME_PASSWORD' : 'POSTGRES_PASSWORD'));
  process.env.DATABASE_URL = url.href;
  if (mode === 'serve') {
    const origin = new URL(process.env.STAFF_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== process.env.STAFF_ORIGIN || origin.username || origin.password || process.env.API_ALLOWED_ORIGINS !== origin.origin) throw new Error('Invalid staff origin');
    for (const name of ['ASSISTANT_GATEWAY_TOKEN', 'INTERNAL_TOOL_SERVICE_TOKEN', 'INTERNAL_CONTEXT_SECRET']) process.env[name] = secret(name, 32);
    const payments = process.env.PAYMENTS_ENABLED;
    if (payments !== undefined && payments !== 'true' && payments !== 'false') throw new Error('Invalid payments flag');
    for (const name of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_SIGNATURE_SECRET']) {
      if (payments === 'false') delete process.env[name];
      else process.env[name] = secret(name);
    }
    if (process.env.MIDTRANS_IS_PRODUCTION !== 'false') throw new Error('Sandbox required');
  }
  const args = mode === 'serve' ? ['dist/main.js'] : ['node_modules/prisma/build/index.js', 'migrate', 'deploy'];
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('Staging process failed; details suppressed'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} catch {
  console.error('Staging configuration invalid; details suppressed');
  process.exitCode = 1;
}
