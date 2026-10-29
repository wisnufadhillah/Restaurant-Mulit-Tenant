const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse } = require('../apps/api/node_modules/dotenv');

function provision(root, checkOnly = false) {
  const paths = ['apps/api/.env', 'apps/assistant/.env'];
  for (const path of paths) {
    execFileSync('git', ['check-ignore', '--quiet', '--', path], { cwd: root, stdio: 'ignore' });
    if (!existsSync(resolve(root, path))) throw new Error('Private configuration files must already exist');
  }
  const sources = paths.map(path => readFileSync(resolve(root, path), 'utf8'));
  const values = sources.map(source => parse(source));
  const additions = [[], []];
  const shared = ['ASSISTANT_GATEWAY_TOKEN', 'INTERNAL_TOOL_SERVICE_TOKEN'];
  for (const name of [...shared, 'INTERNAL_CONTEXT_SECRET']) {
    const targets = shared.includes(name) ? [0, 1] : [0];
    for (const index of targets) {
      const count = sources[index].split(/\r?\n/).filter(line => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line)).length;
      if (count > 1 || count === 1 && !values[index][name]) throw new Error('Duplicate or empty internal configuration; review privately');
    }
    const present = targets.map(index => values[index][name]).filter(Boolean);
    if (present.some(value => !/^[A-Za-z0-9_-]{43,128}$/.test(value))) throw new Error('Existing secret format requires private review');
    if (new Set(present).size > 1) throw new Error('Existing shared configuration mismatch; no files changed');
    if (checkOnly && present.length !== targets.length) throw new Error('Internal configuration is incomplete');
    const value = present[0] ?? (checkOnly ? '' : randomBytes(32).toString('base64url'));
    for (const index of targets) if (!values[index][name]) additions[index].push(`${name}=${value}`);
  }
  if (!checkOnly) {
    // Both files are validated before writes. Retry safely completes a partial write without rotating values.
    for (let index = 0; index < paths.length; index++) {
      if (!additions[index].length) continue;
      const newline = sources[index].includes('\r\n') ? '\r\n' : '\n';
      const separator = sources[index].endsWith('\n') || !sources[index] ? '' : newline;
      writeFileSync(resolve(root, paths[index]), sources[index] + separator + additions[index].join(newline) + newline, { mode: 0o600 });
    }
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check')) throw new Error('Unsupported argument');
    provision(resolve(__dirname, '..'), args.includes('--check'));
    console.log('Internal configuration verified. Secret values suppressed; restart API and assistant.');
  } catch {
    console.error('Provisioning stopped. Check gitignored private files and existing internal variable formats/matches. Values suppressed; do not paste private files.');
    process.exitCode = 1;
  }
}
module.exports = { provision };
