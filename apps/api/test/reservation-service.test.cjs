const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSessionToken } = require('../dist/auth/crypto');
const { ReservationService } = require('../dist/restaurant/reservation.service');
const { ReservationController } = require('../dist/restaurant/reservation.controller');
const status = code => e => e.getStatus() === code;
const body = () => ({ date: '2026-11-15', time: '12:00', partySize: 4, guestName: 'Tamu Demo', guestPhone: '081234567890' });

test('reservation service rejects unauthenticated authority and fails closed on database failures', async () => {
  const service = new ReservationService({ session: async () => { throw new Error('Synthetic unavailable'); }, confirmation: async () => { throw new Error('Synthetic unavailable'); } });
  await assert.rejects(service.session('demo-a', undefined), status(503));
  assert.throws(() => service.confirmation('demo-a', undefined, body()), status(403));
  await assert.rejects(service.confirmation('demo-a', createSessionToken(), body()), status(503));
  assert.throws(() => service.create('demo-a', createSessionToken(), { nonce: createSessionToken(), reservation: body(), confirmed: true }, 'synthetic-request-key'), status(400));
});

test('reservation HTTP boundary requires Origin and rejects duplicate creator cookies', async () => {
  const controller = new ReservationController(new ReservationService({}));
  const response = { setHeader() {} };
  const request = headers => ({ headers, socket: {} });
  await assert.rejects(controller.session('demo-a', {}, request({ 'content-type': 'application/json' }), response), status(403));
  await assert.rejects(controller.session('demo-a', {}, request({ origin: 'https://foreign.invalid', 'content-type': 'application/json' }), response), status(403));
  const name = 'restaurant_reservation_demo-a';
  await assert.rejects(controller.session('demo-a', {}, request({ origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', cookie: `${name}=${createSessionToken()}; ${name}=${createSessionToken()}` }), response), status(403));
});
