const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { saveReportAndCleanup } = require('./chatbot-smoke-assertions.cjs');

const source = readFileSync(resolve(__dirname, 'chatbot-live-browser.integration.cjs'), 'utf8').replace(/\r\n/g, '\n');
const start = source.lastIndexOf('  } finally {');
// The environment restoration has its own finally; select the report cleanup explicitly.
const bodyStart = source.indexOf('    report.screenshot_directory=dir;');
const bodyEnd = source.lastIndexOf('\n  }\n});');
assert.ok(bodyStart > 0 && bodyEnd > bodyStart && start > 0);
const cleanup = source.slice(bodyStart, bodyEnd);

test('actual integration cleanup closes resources when report output fails', async () => {
  const calls = [];
  const context = {
    report: {}, dir: 'synthetic', stamp: 'synthetic', JSON, saveReportAndCleanup,
    writeFileSync: () => { calls.push('write'); throw Error('Synthetic disk failure'); },
    browser: { close: async () => calls.push('browser') },
    web: 'web', python: 'python', config: [], stop: async child => calls.push(child),
    app: { close: async () => calls.push('api') }, db: { $disconnect: async () => calls.push('database') },
    names: ['ORIGIN'], previous: { ORIGIN: 'original' }, process: { env: { ORIGIN: 'temporary' } },
  };
  await assert.rejects(vm.runInNewContext(`(async () => {${cleanup}\n})()`, context));
  assert.deepEqual(calls, ['write', 'browser', 'web', 'python', 'api', 'database']);
  assert.equal(context.process.env.ORIGIN, 'original');
});
