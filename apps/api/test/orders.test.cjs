const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, createHmac, randomUUID } = require('node:crypto');
const { OrdersController } = require('../dist/restaurant/orders.controller');
const { ChatSessionsService } = require('../dist/restaurant/chat-sessions.service');
const { ReservationLimiter } = require('../dist/restaurant/reservation-limiter');

const tenantId = randomUUID(), sessionId = randomUUID(), menuId = randomUUID();
const token = 's'.repeat(43);
const request = (headers = {}) => ({ headers: { cookie: `restaurant_chat=${token}`, origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', ...headers }, socket: { remoteAddress: '127.0.0.1' } });
const response = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value; } });
const body = () => ({ customerName: 'Tamu Demo', idempotencyKey: randomUUID(), items: [{ id: menuId, quantity: 2 }] });
const badStatus = status => error => error.getStatus?.() === status;

function boundary(options = {}) {
  const controller = Object.create(OrdersController.prototype);
  const session = { id: sessionId, tenantId, slug: 'another-restaurant' };
  controller.sessions = { async readForOrders(value) { assert.equal(value, token); return session; } };
  controller.customerLimiter = new ReservationLimiter();
  controller.notificationIngressLimiter = new ReservationLimiter();
  controller.providerLimiter = new ReservationLimiter();
  let state = { orders: [], events: [] }, tail = Promise.resolve(), inTransaction = false;
  let transactions = 0, menuReads = 0;
  function store(next) {
    const match = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
    return {
      $executeRaw: async () => {},
      chatSession: { findFirst: async ({ where }) => { assert.equal(where.tenantId, session.tenantId); assert.equal(where.tenant.status, 'active'); return options.inactive ? null : { id: session.id }; } },
      menuItem: { findMany: async ({ where }) => { menuReads++; assert.equal(where.tenantId, session.tenantId); return options.menuMissing ? [] : [{ id: menuId, name: 'Menu Demo', price: 5000 }]; } },
      order: {
        findUnique: async ({ where }) => next.orders.find(row => where.tenantId_idempotencyKey ? row.tenantId === where.tenantId_idempotencyKey.tenantId && row.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey : match(row, where)) ?? null,
        findUniqueOrThrow: async ({ where }) => { const row = next.orders.find(row => match(row, where)); assert.ok(row); return structuredClone(row); },
        findFirst: async ({ where }) => next.orders.find(row => match(row, where)) ?? null,
        create: async ({ data }) => { const row = { id: randomUUID(), snapToken: null, redirectUrl: null, status: 'pending', ...data }; next.orders.push(row); return row; },
        updateMany: async ({ where, data }) => { if (options.failSave && data.snapToken) throw new Error('Synthetic persistence failure'); let count = 0; for (const row of next.orders) if (match(row, where)) { Object.assign(row, data); count++; } return { count }; },
      },
      orderPaymentEvent: { create: async ({ data }) => { if (options.failAudit) throw new Error('Synthetic audit failure'); next.events.push(data); } },
    };
  }
  controller.db = {
    order: {
      findUnique: async args => store(state).order.findUnique(args),
      findFirst: async args => store(state).order.findFirst(args),
      updateMany: async args => store(state).order.updateMany(args),
    },
    async $transaction(fn, settings) {
      assert.equal(settings.isolationLevel, 'ReadCommitted');
      let release;
      const prior = tail;
      tail = new Promise(resolve => { release = resolve; });
      await prior;
      const next = structuredClone(state);
      inTransaction = true;
      transactions++;
      try { const result = await fn(store(next)); state = next; return result; }
      finally { inTransaction = false; release(); }
    },
  };
  return { controller, session, state: () => state, inTransaction: () => inTransaction, transactions: () => transactions, menuReads: () => menuReads };
}

function sandbox(t) {
  const env = { ...process.env };
  process.env.MIDTRANS_SERVER_KEY = randomUUID();
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  process.env.NODE_ENV = 'test';
  delete process.env.STAFF_ORIGIN;
  const original = global.fetch;
  t.after(() => { global.fetch = original; process.env = env; });
}
function snapFetch(b, handler) {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(b.inTransaction(), false);
    assert.equal(url, 'https://app.sandbox.midtrans.com/snap/v1/transactions');
    assert.equal(options.redirect, 'error');
    const payload = JSON.parse(options.body), row = b.state().orders.find(order => order.midtransOrderId === payload.transaction_details.order_id);
    assert.ok(row, 'intent committed before HTTP');
    assert.equal(row.snapCreationState, 'creating');
    assert.match(payload.transaction_details.order_id, /^[0-9a-f-]{36}$/);
    assert.equal(payload.transaction_details.order_id, row.midtransOrderId);
    assert.equal(payload.transaction_details.gross_amount, 10000);
    assert.equal(Buffer.from(options.headers.authorization.slice(6), 'base64').toString(), `${process.env.MIDTRANS_SERVER_KEY}:`);
    if (handler) return handler(url, options);
    return new Response(JSON.stringify({ token: randomUUID(), redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/demo' }), { status: 201 });
  };
  return () => calls;
}
function notification(order, changes = {}) {
  const value = { order_id: order.midtransOrderId, status_code: '200', gross_amount: '10000.00', transaction_status: 'settlement', ...changes };
  value.signature_key = createHash('sha512').update(`${value.order_id}${value.status_code}${value.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`).digest('hex');
  return value;
}
function remoteFetch(b, changes = {}, status = 200) {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(b.inTransaction(), false);
    const order = b.state().orders[0];
    assert.equal(url, `https://api.sandbox.midtrans.com/v2/${order.midtransOrderId}/status`);
    assert.equal(options.redirect, 'error');
    assert.equal(Buffer.from(options.headers.authorization.slice(6), 'base64').toString(), `${process.env.MIDTRANS_SERVER_KEY}:`);
    return new Response(JSON.stringify({ order_id: order.midtransOrderId, gross_amount: '10000.00', currency: 'IDR', status_code: '200', transaction_status: 'settlement', extra: { allowed: true }, ...changes }), { status });
  };
  return () => calls;
}
async function created(t, options) {
  sandbox(t);
  const b = boundary(options);
  snapFetch(b);
  await b.controller.create(body(), request(), response());
  return b;
}

test('durable order intent replays canonical payload without menu revalidation or second Snap call', async t => {
  sandbox(t);
  const b = boundary(), calls = snapFetch(b), input = body();
  const first = await b.controller.create(input, request(), response());
  const retry = await b.controller.create({ ...input, customerName: ' Tamu Demo ', items: [{ id: menuId, quantity: 1 }, { id: menuId, quantity: 1 }] }, request(), response());
  assert.deepEqual(retry, first);
  assert.equal(calls(), 1);
  assert.equal(b.menuReads(), 1);
  assert.equal(b.state().orders.length, 1);
  assert.equal(b.state().orders[0].snapCreationState, 'ready');
  assert.ok(first.data.snapToken);
  for (const change of [{ customerName: 'Other Guest' }, { items: [{ id: menuId, quantity: 1 }] }]) {
    await assert.rejects(b.controller.create({ ...input, ...change }, request(), response()), badStatus(409));
  }
  b.session.id = randomUUID();
  await assert.rejects(b.controller.create(input, request(), response()), badStatus(403));
  b.session.id = sessionId;
  b.session.tenantId = randomUUID();
  assert.equal((await b.controller.status(first.data.id, request(), response())).data, null);
  await b.controller.create(input, request(), response());
  assert.equal(b.state().orders.length, 2);
  assert.equal(calls(), 2);
  assert.notEqual(b.state().orders[0].midtransOrderId, b.state().orders[1].midtransOrderId);
});

test('parallel same-key requests claim one Snap dispatch without transaction across HTTP', async t => {
  sandbox(t);
  const b = boundary(), input = body();
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const calls = snapFetch(b, async () => { entered(); await gate; return new Response(JSON.stringify({ token: randomUUID(), redirect_url: 'https://app.sandbox.midtrans.com/snap/demo' }), { status: 201 }); });
  const first = b.controller.create(input, request(), response());
  await started;
  await assert.rejects(b.controller.create(input, request(), response()), badStatus(503));
  release();
  const result = await first;
  assert.deepEqual(await b.controller.create(input, request(), response()), result);
  assert.equal(calls(), 1);
  assert.equal(b.state().orders.length, 1);
});

test('uncertain Snap outcome, invalid redirect and failed persistence never trigger second charge', async t => {
  sandbox(t);
  for (const mode of ['timeout', 'http-error', 'bad-json', 'bad-host', 'credentials', 'live-host', 'port', 'persist']) {
    const b = boundary({ failSave: mode === 'persist' }), input = body();
    const calls = snapFetch(b, () => {
      if (mode === 'timeout') throw new Error('Synthetic timeout');
      if (mode === 'http-error') return new Response('{}', { status: 500 });
      if (mode === 'bad-json') return new Response('invalid', { status: 201 });
      const urls = { 'bad-host': 'https://app.sandbox.midtrans.com.evil.example/pay', credentials: 'https://user@app.sandbox.midtrans.com/pay', 'live-host': 'https://app.midtrans.com/pay', port: 'https://app.sandbox.midtrans.com:444/pay' };
      return new Response(JSON.stringify({ token: randomUUID(), redirect_url: urls[mode] ?? 'https://app.sandbox.midtrans.com/pay' }), { status: 201 });
    });
    await assert.rejects(b.controller.create(input, request(), response()));
    await assert.rejects(b.controller.create(input, request(), response()), badStatus(503));
    assert.equal(calls(), 1, mode);
    assert.equal(b.state().orders.length, 1);
    assert.equal(b.state().orders[0].snapCreationState, mode === 'persist' ? 'creating' : 'unknown');
  }
});

test('order validation rejects extra prices, empty key and aggregate quantity before dispatch', async t => {
  sandbox(t);
  const b = boundary(), calls = snapFetch(b);
  for (const input of [{ ...body(), price: 1 }, { ...body(), idempotencyKey: '' }, { ...body(), items: [{ id: menuId, quantity: 20 }, { id: menuId, quantity: 1 }] }, { ...body(), items: [null] }, { ...body(), items: [{ id: 'invalid', quantity: 1 }] }]) {
    await assert.rejects(b.controller.create(input, request(), response()), badStatus(400));
  }
  assert.equal(calls(), 0);
  assert.equal(b.state().orders.length, 0);
});

test('ordinary SHA512 accepts decimal nominal and rejects HMAC, malformed signatures and wrong nominal', async t => {
  const b = await created(t), row = b.state().orders[0], calls = remoteFetch(b);
  const valid = notification(row);
  const hmac = createHmac('sha512', process.env.MIDTRANS_SERVER_KEY).update(`${valid.order_id}${valid.status_code}${valid.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`).digest('hex');
  for (const bad of [null, [], { ...valid, signature_key: [] }, { ...valid, signature_key: 'z'.repeat(128) }, { ...valid, signature_key: 'a'.repeat(126) }, { ...valid, signature_key: hmac }, notification(row, { gross_amount: '10000.01' }), notification(row, { gross_amount: '1e4' }), notification(row, { transaction_status: [] }), notification(row, { status_code: 200 }), notification(row, { currency: 'USD' }), notification(row, { fraud_status: 'unknown' }), notification({ midtransOrderId: randomUUID() })]) {
    await assert.rejects(b.controller.notification(bad), badStatus(400));
  }
  assert.equal(calls(), 0);
  await b.controller.notification(valid);
  assert.equal(b.state().orders[0].paymentStatus, 'settlement');
  assert.equal(b.state().orders[0].status, 'confirmed');
  assert.equal(b.state().events.length, 1);
});

test('remote status errors and identity, amount, currency or field mismatch fail closed', async t => {
  const b = await created(t), value = notification(b.state().orders[0]);
  for (const [changes, status] of [[{}, 404], [{ order_id: randomUUID() }, 200], [{ gross_amount: '9999.99' }, 200], [{ gross_amount: 10000 }, 200], [{ currency: 'USD' }, 200], [{ currency: undefined }, 200], [{ transaction_status: 'unexpected' }, 200], [{ status_code: 200 }, 200], [{ fraud_status: false }, 200]]) {
    remoteFetch(b, changes, status);
    await assert.rejects(b.controller.notification(value), badStatus(503));
  }
  for (const fetcher of [async () => { throw new Error('Synthetic timeout'); }, async () => new Response('invalid')]) {
    global.fetch = fetcher;
    await assert.rejects(b.controller.notification(value), badStatus(503));
  }
  assert.equal(b.state().orders[0].paymentStatus, 'pending');
  assert.equal(b.state().events.length, 0);
});

test('capture accepts omitted fraud status; fraud deny never settles', async t => {
  sandbox(t);
  for (const [fraud, expected] of [[undefined, 'settlement'], ['accept', 'settlement'], ['challenge', 'pending'], ['deny', 'deny']]) {
    const b = boundary(); snapFetch(b);
    await b.controller.create(body(), request(), response());
    remoteFetch(b, { transaction_status: 'capture', fraud_status: fraud });
    await b.controller.notification(notification(b.state().orders[0], { transaction_status: 'capture', fraud_status: fraud }));
    assert.equal(b.state().orders[0].paymentStatus, expected);
  }
  const b = boundary(); snapFetch(b);
  await b.controller.create(body(), request(), response());
  remoteFetch(b);
  await assert.rejects(b.controller.notification(notification(b.state().orders[0], { fraud_status: 'deny' })), badStatus(400));
  assert.equal(b.state().events.length, 0);
});

test('duplicate, parallel and out-of-order notifications preserve monotonic status with one atomic audit', async t => {
  const b = await created(t), value = notification(b.state().orders[0]);
  remoteFetch(b, { transaction_status: 'expire' });
  await b.controller.notification(value);
  remoteFetch(b, { transaction_status: 'pending' });
  await b.controller.notification(value);
  assert.equal(b.state().orders[0].paymentStatus, 'expire');
  remoteFetch(b);
  await Promise.all([b.controller.notification(value), b.controller.notification(value)]);
  remoteFetch(b, { transaction_status: 'cancel' });
  await b.controller.notification(value);
  assert.equal(b.state().orders[0].paymentStatus, 'settlement');
  assert.deepEqual(b.state().events.map(row => [row.fromStatus, row.toStatus]), [['pending', 'expire'], ['expire', 'settlement']]);
  assert.deepEqual(Object.keys(b.state().events[0]).sort(), ['fromStatus', 'orderId', 'tenantId', 'toStatus']);
});

test('payment failure maps to stored denial and cannot regress to pending', async t => {
  const b = await created(t), value = notification(b.state().orders[0], { transaction_status: 'failure' });
  remoteFetch(b, { transaction_status: 'failure' });
  await b.controller.notification(value);
  remoteFetch(b, { transaction_status: 'pending' });
  await b.controller.notification(value);
  assert.equal(b.state().orders[0].paymentStatus, 'deny');
  assert.equal(b.state().events.length, 1);
});

test('authoritative unsuccessful status code cannot settle and oversized notification never reaches HTTP', async t => {
  const b = await created(t), value = notification(b.state().orders[0]);
  const calls = remoteFetch(b, { status_code: '201' });
  await assert.rejects(b.controller.notification(value), badStatus(400));
  await assert.rejects(b.controller.notification({ ...value, extra: 'x'.repeat(16384) }), badStatus(400));
  assert.equal(calls(), 1);
  assert.equal(b.state().events.length, 0);
});

test('Snap result persists even if session expires during HTTP, without exposing payment credential', async t => {
  sandbox(t);
  const b = boundary(), input = body();
  snapFetch(b, async () => {
    b.controller.sessions.readForOrders = async () => { const error = new Error('Expired session'); error.getStatus = () => 403; throw error; };
    return new Response(JSON.stringify({ token: randomUUID(), redirect_url: 'https://app.sandbox.midtrans.com/snap/demo' }), { status: 201 });
  });
  await assert.rejects(b.controller.create(input, request(), response()), badStatus(403));
  assert.equal(b.state().orders[0].snapCreationState, 'ready');
  assert.ok(b.state().orders[0].snapToken);
});

test('audit failure rolls back status and returns non-success for provider retry', async t => {
  const b = await created(t, { failAudit: true });
  remoteFetch(b);
  await assert.rejects(b.controller.notification(notification(b.state().orders[0])), /Synthetic audit failure/);
  assert.equal(b.state().orders[0].paymentStatus, 'pending');
  assert.equal(b.state().orders[0].status, 'pending');
  assert.equal(b.state().events.length, 0);
});

test('orders enforce Origin, no-store, active owner and bounded rate limits; same-origin GET may omit Origin', async t => {
  const b = await created(t), id = b.state().orders[0].id;
  const res = response();
  assert.ok((await b.controller.status(id, request({ origin: undefined }), res)).data);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  for (const headers of [{ origin: 'https://evil.example' }, { origin: undefined, 'sec-fetch-site': 'cross-site' }]) {
    await assert.rejects(b.controller.status(id, request(headers), response()), badStatus(403));
  }
  await assert.rejects(b.controller.create(body(), request({ origin: undefined }), response()), badStatus(403));
  await assert.rejects(b.controller.create(body(), request({ 'content-type': 'text/plain' }), response()), badStatus(403));
  for (let i = 0; i < 58; i++) await b.controller.status(id, request(), response());
  await assert.rejects(b.controller.status(id, request(), response()), badStatus(429));
  const inactive = boundary({ inactive: true });
  await assert.rejects(inactive.controller.create(body(), request(), response()), badStatus(403));
});

test('anonymous notification flood cannot exhaust customer or signed provider budgets', async t => {
  const b = await created(t), row = b.state().orders[0], valid = notification(row);
  const calls = remoteFetch(b);
  for (let i = 0; i < 2002; i++) {
    const invalid = i % 2 ? { ...valid, signature_key: '0'.repeat(128) } : { ...valid, signature_key: undefined };
    await assert.rejects(b.controller.notification(invalid), badStatus(i < 2000 ? 400 : 429));
  }
  assert.equal(calls(), 0);
  assert.ok((await b.controller.status(row.id, request(), response())).data);
  const creates = snapFetch(b);
  await b.controller.create(body(), request(), response());
  assert.equal(creates(), 1);
  remoteFetch(b);
  assert.deepEqual(await b.controller.notification(valid), { ok: true });
  assert.equal(b.state().orders[0].paymentStatus, 'settlement');
});

test('signed provider work caps concurrent verification and releases slots after success or failure', async t => {
  const b = await created(t), value = notification(b.state().orders[0]);
  let release, entered = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const original = remoteFetch(b);
  const fetchStatus = global.fetch;
  global.fetch = async (...args) => { entered++; await gate; return fetchStatus(...args); };
  const active = Array.from({ length: 4 }, () => b.controller.notification(value));
  while (entered < 4) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(b.controller.notification(value), badStatus(429));
  assert.equal(original(), 0);
  release();
  await Promise.all(active);
  assert.equal(original(), 4);
  global.fetch = async () => { throw new Error('Synthetic provider failure'); };
  for (let i = 0; i < 5; i++) await assert.rejects(b.controller.notification(value), badStatus(503));
  const calls = remoteFetch(b);
  await b.controller.notification(value);
  assert.equal(calls(), 1);
  assert.equal(b.state().events.length, 1);
});

test('signed provider verification budget is bounded independently of customer access', async t => {
  const b = await created(t), value = notification(b.state().orders[0]);
  const calls = remoteFetch(b);
  for (let i = 0; i < 120; i++) await b.controller.notification(value);
  await assert.rejects(b.controller.notification(value), badStatus(429));
  assert.equal(calls(), 120);
  assert.ok((await b.controller.status(b.state().orders[0].id, request(), response())).data);
});

test('sandbox-only config rejects live or ambiguous flags at startup and before dispatch', async t => {
  sandbox(t);
  const b = boundary(), calls = snapFetch(b);
  for (const flag of ['true', 'TRUE', '1', '']) {
    process.env.MIDTRANS_IS_PRODUCTION = flag;
    assert.throws(() => b.controller.onModuleInit(), /Only sandbox/);
    await assert.rejects(b.controller.create(body(), request(), response()), /Only sandbox/);
  }
  assert.equal(calls(), 0);
});

test('order session resolves active tenant from hashed cookie without caller-selected slug', async () => {
  const service = Object.create(ChatSessionsService.prototype);
  let query;
  service.db = { chatSession: { findFirst: async args => { query = args; return { id: sessionId, tenantId, tenant: { slug: 'another-restaurant' }, expiresAt: new Date(5000) }; } } };
  assert.deepEqual(await service.readForOrders(token, 1000), { id: sessionId, tenantId, slug: 'another-restaurant', expiresAt: 5000 });
  assert.equal(query.where.tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.equal(query.where.revokedAt, null);
  assert.equal(query.where.expiresAt.gt.getTime(), 1000);
  assert.deepEqual(query.where.tenant, { status: 'active' });
  assert.equal('tenantId' in query.where, false);
  await assert.rejects(service.readForOrders(sessionId), badStatus(403));
  service.db.chatSession.findFirst = async () => null;
  await assert.rejects(service.readForOrders(token), badStatus(403));
});
