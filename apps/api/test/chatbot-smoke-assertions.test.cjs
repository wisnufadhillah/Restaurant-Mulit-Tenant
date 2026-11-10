const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertSmokeTurn, saveReportAndCleanup } = require('./chatbot-smoke-assertions.cjs');
const menu = { name: 'Rendang sapi', price: 35000 };
const source = { documentId: 'synthetic-document', revision: 7, title: 'Panduan website' };
const turn = (message, cards, attempted_requests = 1) => ({ status: 'ok', message, cards, attempted_requests });

test('correct menu card does not authorize an incorrect or missing answer price', () => {
  const cards = [{ type: 'menu', data: [menu] }];
  assertSmokeTurn('menu', turn('Rendang Rp35.000.', cards), menu);
  for (const text of ['Rendang Rp99.000.', 'Rendang tersedia.', 'Rendang Rp35.000 atau Rp99.000.']) {
    assert.throws(() => assertSmokeTurn('menu', turn(text, cards), menu));
  }
});

test('FAQ requires expected current source and bounded guest-access answer checks', () => {
  const text = 'Tanpa membuat akun. Pengelolaan memerlukan sesi privat; kode referensi saja tidak cukup.';
  const cards = [{ type: 'knowledge', data: [source] }];
  assertSmokeTurn('faq', turn(text, cards), menu, source);
  for (const badSource of [{ ...source, revision: 1 }, { ...source, documentId: 'other' }]) {
    assert.throws(() => assertSmokeTurn('faq', turn(text, [{ type: 'knowledge', data: [badSource] }]), menu, source));
  }
  for (const answer of ['Anda harus membuat akun.', 'Tanpa akun; kode referensi cukup untuk semua akses.']) {
    assert.throws(() => assertSmokeTurn('faq', turn(answer, cards), menu, source));
  }
});

test('reservation requires form redirect without success claims or model requests', () => {
  const text = 'Gunakan form Reservasi pada website.';
  assertSmokeTurn('reservation', turn(text, [], 0));
  for (const bad of [turn(text, [], 1), turn(text + ' Reservasi berhasil.', [], 0), turn('Halo.', [], 0)]) {
    assert.throws(() => assertSmokeTurn('reservation', bad));
  }
});

test('report write failure still runs cleanup and preserves failure', async () => {
  const calls = [];
  const failure = new Error('Synthetic report write failure');
  await assert.rejects(saveReportAndCleanup(() => { throw failure; }, async () => {
    for (const stage of ['browser', 'web', 'python', 'api', 'database', 'environment']) calls.push(stage);
  }), error => error === failure);
  assert.deepEqual(calls, ['browser', 'web', 'python', 'api', 'database', 'environment']);
});
