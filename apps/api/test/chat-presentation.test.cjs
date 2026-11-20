const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = resolve(__dirname, '../../web/app/components/chat-presentation.ts');
const instance = new Module(filename);
instance._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { maskedChatPreview, menuDescription } = instance.exports;

test('menu descriptions omit internal demo notices without inventing dish details', () => {
  assert.equal(menuDescription('Ayam khas Minang dengan sambal tomat. Data demo sintetis.'), 'Ayam khas Minang dengan sambal tomat.');
  assert.equal(menuDescription('Menu sintetis untuk demo rumah makan. Harga dapat diubah pemilik.'), '');
  assert.equal(menuDescription('Data demo sintetis'), '');
  assert.equal(menuDescription('Teh tanpa gula.'), 'Teh tanpa gula.');
  assert.equal(menuDescription(''), '');
});

test('immediate chat preview masks contacts and access-like strings', () => {
  const preview = maskedChatPreview('  halo demo@example.test +6281234567890 abcdefghijklmnopqrstuvwxyz  ');
  assert.equal(preview, 'halo [kontak disamarkan] [nomor disamarkan] [nilai privat disamarkan]');
  assert.equal(maskedChatPreview('Jam buka berapa?'), 'Jam buka berapa?');
});
