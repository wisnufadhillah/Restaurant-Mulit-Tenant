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

test('existing session verification remains available after shared creation quota is exhausted', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) await f.service.session('demo-a', undefined, 'proxy-peer');
  await assert.rejects(async () => f.service.session('demo-a', undefined, 'proxy-peer'), limited);
  await f.service.session('demo-a', createSessionToken(), 'proxy-peer');
  await f.service.session('demo-a', createSessionToken(), 'proxy-peer');
  assert.equal(f.calls(), 22);
});

test('rotating tokens have a bounded verification budget and window resets', async () => {
  let now = 0, calls = 0;
  const { ForbiddenException } = require('@nestjs/common');
  const service = new ReservationService({ session: async () => { calls++; throw new ForbiddenException(); } });
  service.limiter = new ReservationLimiter(() => now);
  for (let i = 0; i < 120; i++) await assert.rejects(service.session('demo-a', createSessionToken(), 'proxy-peer'), e => e.getStatus() === 403);
  await assert.rejects(async () => service.session('demo-a', createSessionToken(), 'proxy-peer'), limited);
  assert.equal(calls, 120);
  now = 60000;
  await assert.rejects(service.session('demo-a', createSessionToken(), 'proxy-peer'), e => e.getStatus() === 403);
  assert.equal(calls, 121);
});

test('session reuse counts token quota once and mixed requests count global quota once', async () => {
  const f = fixture(), token = createSessionToken();
  for (let i = 0; i < 60; i++) await f.service.session('demo-a', token, 'proxy-peer');
  await assert.rejects(async () => f.service.session('demo-a', token, 'proxy-peer'), limited);
  assert.equal(f.calls(), 60);
  // The denied token request also consumed one global admission.
  for (let i = 0; i < 1939; i++) await f.service.manage('demo-a', createSessionToken(), false);
  assert.equal(f.calls(), 1999);
  await assert.rejects(async () => f.service.manage('demo-a', createSessionToken(), false), limited);
  assert.equal(f.calls(), 1999);
});

test('verification concurrency releases after failure and survives window reset', async () => {
  let now = 0;
  const limiter = new ReservationLimiter(() => now);
  const gates = [];
  const service = new ReservationService({ session: async () => new Promise((resolve, reject) => gates.push({ resolve, reject })) });
  service.limiter = limiter;
  const pending = Array.from({ length: 4 }, () => service.session('demo-a', createSessionToken(), 'proxy-peer'));
  await assert.rejects(async () => service.session('demo-a', createSessionToken(), 'proxy-peer'), limited);
  now = 60000;
  await assert.rejects(async () => service.session('demo-a', createSessionToken(), 'proxy-peer'), limited);
  gates[0].reject(new Error('Synthetic dependency failure'));
  await assert.rejects(pending[0], e => e.getStatus() === 503);
  const next = service.session('demo-a', createSessionToken(), 'proxy-peer');
  for (const gate of gates.slice(1)) gate.resolve({});
  await Promise.all([...pending.slice(1), next]);
  const release = limiter.acquireVerification(); release(); release();
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
