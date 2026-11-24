const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChatMessageController, redactChat } = require('../dist/restaurant/chat-message.controller');

function fixture(transport, menuAvailable = true, drinkAvailable = true) {
  const saved = [], prompts = [];
  let menuCalls = 0, active = true;
  const sessions = {
    async read() { if (!active) throw new Error('Synthetic expired session'); return { id: 'synthetic-session', slug: 'demo-padang' }; },
    async context() { return { sessionId: 'synthetic-context', context: 'synthetic' }; },
    async history() { return saved; },
    async assertActive() { if (!active) throw new Error('Synthetic expired session'); },
    async append(_token, _slug, messages) { saved.push(...messages); },
  };
  const menu = { async publicList(slug) {
    menuCalls++;
    assert.equal(slug, 'demo-padang');
    if (!menuAvailable) throw new Error('Synthetic menu outage');
    return { data: [{ id: 'synthetic-menu', name: 'Nasi sintetis', price: 5000, isAvailable: true }, { id: 'synthetic-drink', name: 'Es teh sintetis', price: 4000, isAvailable: drinkAvailable }] };
  } };
  const controller = new ChatMessageController(sessions, { async send(body) { prompts.push(structuredClone(body)); return transport(body); } }, menu);
  const request = { headers: { origin: 'http://127.0.0.1:3000' }, socket: {} }, response = { setHeader() {} };
  return { send: message => controller.send({ message }, request, response), saved, prompts, menuCalls: () => menuCalls, expire: () => { active = false; } };
}

const outage = async () => { throw new Error('Synthetic assistant outage'); };

test('assistant outage routes reservation wording and details without requiring menu', async () => {
  for (const message of ['Saya ingin reservasi', 'reservasi dong', 'Booking besok jam 19.00 untuk 4 pax', 'Pesan meja 20-11-2026 jam 19.00 4 orang', 'Lihat reservasi', 'Batalkan booking']) {
    for (const menuAvailable of [true, false]) {
      const f = fixture(outage, menuAvailable);
      const result = await f.send(message);
      assert.equal(result.status, 'partial', message);
      assert.deepEqual(result.cards, []);
      assert.deepEqual(result.actions, [{ id: 'reservation-form', type: 'navigate', label: 'Buka form reservasi', target: '#reservasi' }]);
      assert.match(result.message, /form reservasi/i);
      assert.doesNotMatch(result.message, /meja tersedia|terkonfirmasi|ditahan/i);
      assert.equal(f.menuCalls(), 1);
      assert.equal(f.prompts.length, 1);
    }
  }
});

test('food orders and mixed reservation menu questions retain menu fallback', async () => {
  for (const message of ['Pesan nasi sintetis dua porsi', 'Reservasi besok dan lihat menu', 'Booking dan pesan nasi sintetis', 'Menu untuk reservasi besok?']) {
    const f = fixture(outage);
    const result = await f.send(message);
    assert.equal(f.menuCalls(), 1, message);
    assert.equal(result.cards[0].type, 'menu');
  }
});

test('mixed reservation and catalogue item questions reflect actual availability', async () => {
  for (const available of [true, false]) {
    const f = fixture(outage, true, available);
    const result = await f.send('Booking besok, es teh sintetis tersedia?');
    assert.equal(f.menuCalls(), 1);
    assert.equal(result.status, 'partial');
    assert.equal(result.cards[0].type, 'menu');
    assert.equal(result.cards[0].data.find(item => item.name === 'Es teh sintetis').isAvailable, available);
    assert.equal(result.message, `Es teh sintetis saat ini ${available ? 'tersedia' : 'habis'} menurut menu restoran.`);
    assert.deepEqual(result.actions, [{ id: 'menu-section', type: 'navigate', label: 'Lihat menu lengkap', target: '#menu' }]);
  }
});

test('dates embedded in whole phone ranges stay masked in transport and both history roles', async () => {
  for (const phone of ['0812 (20-11-2026) 99', '0812 2026-11-20 99']) {
    const message = `Reservasi, kontak ${phone}`;
    const expected = 'Reservasi, kontak [nomor disamarkan]';
    const f = fixture(async () => ({ status: 'ok', message, cards: [], actions: [] }));
    const result = await f.send(message);
    assert.equal(result.input, expected);
    assert.equal(result.message, expected);
    assert.equal(f.prompts[0].message, expected);
    assert.deepEqual(f.saved, [{ role: 'user', content: expected }, { role: 'assistant', content: expected }]);
    await f.send('Riwayat?');
    assert.deepEqual(f.prompts[1].history, [{ role: 'user', content: expected }, { role: 'assistant', content: expected }]);
  }
});

test('valid standalone dates survive transport and persisted history while private values do not', async () => {
  for (const date of ['20 November 2026', '20/11/2026', '20-11-2026', '2026-11-20', '29-02-2028']) {
    const message = `Reservasi ${date} jam 19:30 untuk 4 pax, telepon +6281234567890 atau 0812-3456-7890, email synthetic@example.test, kode ${'x'.repeat(32)}`;
    const f = fixture(async body => ({ status: 'ok', message: body.message, cards: [], actions: [] }));
    const result = await f.send(message);
    await f.send('Riwayat?');
    for (const safe of [result.input, result.message, f.prompts[0].message, JSON.stringify(f.saved), JSON.stringify(f.prompts[1].history)]) {
      assert.ok(safe.includes(date), date);
      assert.ok(safe.includes('19:30'));
      for (const privateValue of ['+6281234567890', '0812-3456-7890', 'synthetic@example.test', 'x'.repeat(32)]) assert.ok(!safe.includes(privateValue));
      assert.ok(safe.includes('[nomor disamarkan]'));
      assert.ok(safe.includes('[kontak disamarkan]'));
      assert.ok(safe.includes('[nilai privat disamarkan]'));
    }
  }
});

test('date masking checks calendar and standalone boundaries rather than exempting numeric tokens', () => {
  for (const date of ['29-02-2028', '2028-02-29', '1-1-2026', '(20-11-2026)', '20-11-2026,']) assert.equal(redactChat(date), date);
  for (const value of ['31-02-2026', '29-02-2026', '2026-02-29', '00-11-2026', '20-13-2026', '2026112000', '0812-20-11-2026-99', '+2026-11-20', 'prefix2026-11-20suffix', `secret_${'x'.repeat(24)}_2026-11-20`]) {
    assert.notEqual(redactChat(value), value, value);
    assert.ok(!redactChat(value).includes('2026-11-20'), value);
  }
});

test('structured unavailable reply keeps its form action and active session checks', async () => {
  const actions = [{ id: 'reservation-form', type: 'navigate', label: 'Buka form reservasi', target: '#reservasi' }];
  const f = fixture(async () => ({ status: 'unavailable', message: 'Asisten belum tersedia.', cards: [], actions }));
  assert.deepEqual((await f.send('Reservasi besok')).actions, actions);
  assert.equal(f.saved.length, 2);
  f.expire();
  await assert.rejects(f.send('Reservasi'));
});

test('reservation fallback releases busy state and preserves five turn budget', async () => {
  const f = fixture(outage, false);
  for (let i = 0; i < 5; i++) assert.equal((await f.send('Reservasi dong')).status, 'partial');
  await assert.rejects(f.send('Reservasi dong'), error => error.getStatus() === 429);
  assert.equal(f.prompts.length, 5);
  assert.equal(f.menuCalls(), 5);
});
