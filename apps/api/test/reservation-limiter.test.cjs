const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ReservationLimiter } = require('../dist/restaurant/reservation-limiter');
const { ReservationService } = require('../dist/restaurant/reservation.service');
const { ApiErrorFilter } = require('../dist/http/error.filter');
const { createSessionToken } = require('../dist/auth/crypto');
const limited = e => e.getStatus() === 429;

function fixture() {
  let now = 0, calls = 0;
  const repository = { manage: async () => { calls++; }, revokeManagement: async () => { calls++; }, session: async () => { calls++; return {}; } };
  const service = new ReservationService(repository);
  service.limiter = new ReservationLimiter(() => now);
  return { service, calls: () => calls, time: value => { now = value; } };
}

test('actual service shares session quota across operations and rejects without DB access', async () => {
  const f = fixture(), token = createSessionToken();
  for (let i = 0; i < 60; i++) await f.service.manage('demo-a', token, false);
  await assert.rejects(async () => f.service.revokeManagement('demo-b', token), limited);
  assert.equal(f.calls(), 60);
  f.time(60000);
  await f.service.revokeManagement('demo-a', token);
  assert.equal(f.calls(), 61);
});

test('peer session quota resets exactly at expiry and does not affect another peer', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) await f.service.session('demo-a', undefined, '127.0.0.1');
  await assert.rejects(async () => f.service.session('demo-a', undefined, '127.0.0.1'), limited);
  await f.service.session('demo-a', undefined, '127.0.0.2');
  f.time(59999);
  await assert.rejects(async () => f.service.session('demo-a', undefined, '127.0.0.1'), e => limited(e) && e.retryAfterSeconds === 1);
  assert.equal(f.calls(), 21);
  f.time(60000);
  await f.service.session('demo-a', undefined, '127.0.0.1');
  assert.equal(f.calls(), 22);
});

test('invalid requests consume bounded global quota without touching DB', async () => {
  const f = fixture();
  for (let i = 0; i < 2000; i++) await assert.rejects(async () => f.service.manage('!', undefined, false), e => e.getStatus() === 400);
  await assert.rejects(async () => f.service.manage('demo-a', createSessionToken(), false), limited);
  assert.equal(f.calls(), 0);
});

test('identity capacity fails closed without evicting existing quota and expires', () => {
  let now = 0;
  const limiter = new ReservationLimiter(() => now, 2);
  const a = 'a'.repeat(64), b = 'b'.repeat(64), c = 'c'.repeat(64);
  limiter.consume(a); limiter.consume(b);
  assert.throws(() => limiter.consume(c), limited);
  for (let i = 1; i < 60; i++) limiter.consume(a);
  assert.throws(() => limiter.consume(a), limited);
  now = 60000;
  limiter.consume(c);
});

test('actual error filter returns retry delay and sanitized standard envelope', () => {
  const limiter = new ReservationLimiter(() => 0);
  for (let i = 0; i < 20; i++) limiter.consume(undefined, true, 'local-peer');
  let error;
  try { limiter.consume(undefined, true, 'local-peer'); } catch (e) { error = e; }
  const headers = {};
  let code, body;
  const response = { setHeader(k, v) { headers[k] = v; }, status(n) { code = n; return this; }, json(value) { body = value; } };
  new ApiErrorFilter().catch(error, { switchToHttp: () => ({ getResponse: () => response }) });
  assert.equal(code, 429);
  assert.deepEqual(headers, { 'Retry-After': '60', 'Cache-Control': 'no-store' });
  assert.deepEqual(body.error, { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan.' });
  assert.equal(JSON.stringify(body).includes('local-peer'), false);
});
