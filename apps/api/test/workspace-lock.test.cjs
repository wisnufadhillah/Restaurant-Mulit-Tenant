const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

test('workspace lock retains pinned pnpm metadata and one application document', () => {
  const root = resolve(__dirname, '../../..');
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(manifest.packageManager, 'pnpm@12.15.0');
  const documents = lock.split(/^---\n/gm);
  assert.deepEqual(documents.map(document => document.trim().length > 0), [false, true, true]);
  assert.match(documents[1], /packageManagerDependencies:\n      pnpm:\n        specifier: 12\.15\.0\n        version: 12\.15\.0/);
  assert.match(documents[1], /pnpm@12\.15\.0:/);
  assert.match(documents[2], /apps\/api:/);
  assert.match(documents[2], /apps\/web:/);
});
