const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StaffController } = require('../dist/auth/staff.controller');

test('default development origin works without accepting foreign origins or production defaults', () => {
  const previousMode = process.env.NODE_ENV, previousOrigin = process.env.STAFF_ORIGIN;
  const controller = new StaffController({});
  const response = { setHeader() {} };
  const request = origin => ({ headers: { origin }, socket: {} });
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.STAFF_ORIGIN;
    assert.doesNotThrow(() => controller.prepare(request('http://127.0.0.1:3000'), response, true));
    assert.doesNotThrow(() => controller.prepare(request('http://localhost:3000'), response, true));
    assert.throws(() => controller.prepare(request('http://foreign.example'), response, true), error => error.getStatus() === 403);
    assert.throws(() => controller.prepare({ headers: { origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'cross-site' } }, response, true), error => error.getStatus() === 403);
    process.env.NODE_ENV = 'production';
    assert.throws(() => controller.prepare(request('http://127.0.0.1:3000'), response, true), error => error.getStatus() === 503);
    process.env.STAFF_ORIGIN = 'https://restaurant.example';
    assert.doesNotThrow(() => controller.prepare(request('https://restaurant.example'), response, true));
    assert.throws(() => controller.prepare(request('http://localhost:3000'), response, true), error => error.getStatus() === 403);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousOrigin === undefined) delete process.env.STAFF_ORIGIN; else process.env.STAFF_ORIGIN = previousOrigin;
  }
});
