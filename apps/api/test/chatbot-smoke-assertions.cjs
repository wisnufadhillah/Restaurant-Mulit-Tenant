const assert = require('node:assert/strict');

function assertSmokeTurn(name, result, expectedMenu, expectedKnowledge) {
  assert.equal(result.status, 'ok', 'Live turn did not complete');
  assert.equal(typeof result.message, 'string');
  assert.ok(Array.isArray(result.cards));
  if (name === 'menu') {
    assert.ok(result.cards.some(card => card.type === 'menu' && card.data.some(item => item.name === expectedMenu.name && item.price === expectedMenu.price)));
    const prices = [...result.message.matchAll(/Rp\s*([\d.,]+)/gi)].map(match => Number(match[1].replace(/[.,]/g, '')));
    assert.ok(prices.length > 0 && prices.every(price => price === expectedMenu.price), 'Answer must state only the expected menu price');
    assert.match(result.message, /rendang/i);
  } else if (name === 'faq') {
    assert.ok(expectedKnowledge, 'Published current website guidance required');
    assert.ok(result.cards.some(card => card.type === 'knowledge' && card.data.some(item =>
      item.documentId === expectedKnowledge.documentId && item.revision === expectedKnowledge.revision && item.title === expectedKnowledge.title)));
    // This smoke question concerns guest access, not arbitrary FAQ entailment.
    assert.match(result.message, /(?:tanpa (?:membuat |memiliki )?akun|tidak (?:perlu|wajib)|tidak,)/i);
    assert.match(result.message, /(?:sesi|akses) privat/i);
    assert.match(result.message, /kode referensi/i);
    assert.match(result.message, /(?:tidak cukup|tidak (?:memberi|memberikan)|bukan bukti|saja tidak)/i);
    assert.doesNotMatch(result.message, /(?:wajib|harus|perlu) (?:membuat|memiliki|mendaftar) akun/i);
  } else if (name === 'reservation') {
    assert.equal(result.attempted_requests, 0);
    assert.deepEqual(result.cards, []);
    assert.match(result.message, /form\s+reservasi.*website/i);
    assert.doesNotMatch(result.message, /(?:booking|reservasi)\s+(?:berhasil|sukses|terkonfirmasi|sudah dikonfirmasi)|meja\s+(?:tersedia|dipesan)/i);
  } else {
    throw new Error('Unknown smoke scenario');
  }
}

async function saveReportAndCleanup(save, cleanup) {
  try { await save(); }
  finally { await cleanup(); }
}

module.exports = { assertSmokeTurn, saveReportAndCleanup };
