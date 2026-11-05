const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Module, NotFoundException, ConflictException } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { AvailabilityController } = require('../dist/restaurant/availability.controller');
const { AvailabilityService } = require('../dist/restaurant/availability.service');
const { AvailabilityRepository } = require('../dist/restaurant/availability.repository');
const { ApiErrorFilter } = require('../dist/http/error.filter');

const policy = { timezone: 'Asia/Jakarta', durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, maxPartySize: 12, cancelCutoffMinutes: 120 };
function query() {
  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  return new URLSearchParams({ date: day, time: '12:00', partySize: '4' });
}

test('public availability validates query, separates catalogue scope and exposes no private fields', async () => {
  let mode = 'normal';
  const repository = { async snapshot(slug) {
    if (mode === 'failure') throw new Error('Synthetic database failure');
    if (slug === 'missing' || slug === 'inactive') throw new NotFoundException();
    if (slug === 'ambiguous') throw new ConflictException();
    return { policy, weeklyHours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, openMinute: 0, closeMinute: 1440 })), specialHours: [], tables: [{ id: 'private-table', capacity: 4, isActive: true }], reservations: slug === 'other' ? [{ tableId: 'private-table', startAt: new Date(0), endAt: new Date('2100-01-01'), status: 'confirmed' }] : [] };
  } };
  class TestModule {}
  Module({ controllers: [AvailabilityController], providers: [AvailabilityService, { provide: AvailabilityRepository, useValue: repository }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ApiErrorFilter());
  try {
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/api/v1/public/tenants`;
    const get = (slug = 'demo', params = query()) => fetch(`${root}/${slug}/availability?${params}`);
    const response = await get();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['data', 'retrieved_at', 'source']);
    assert.deepEqual(Object.keys(body.data).sort(), ['available', 'endAt', 'held', 'startAt', 'timezone']);
    assert.equal(body.data.available, true); assert.equal(body.data.held, false);
    assert.equal(body.source, 'restaurant_api');
    assert.ok(Number.isFinite(Date.parse(body.retrieved_at)));
    assert.equal((await (await get('other')).json()).data.available, false);
    for (const [slug, expected] of [['missing', 404], ['inactive', 404], ['INVALID', 404], ['ambiguous', 409]]) assert.equal((await get(slug)).status, expected);
    for (const change of [p => p.append('tenantId', 'other'), p => p.append('outletId', 'other'), p => p.append('date', p.get('date')), p => p.append('partySize', '4'), p => p.delete('date'), p => p.set('date', '2026-02-30'), p => p.set('time', '24:00'), p => p.set('partySize', '4.0'), p => p.set('partySize', '4e0'), p => p.set('partySize', '04'), p => p.set('partySize', '13'), p => p.set('partySize', ''), p => p.append('partySize[x]', '4')]) {
      const params = query(); change(params);
      const invalid = await get('demo', params);
      assert.equal(invalid.status, 400, params.toString());
      assert.equal(invalid.headers.get('cache-control'), 'no-store');
    }
    mode = 'failure';
    const failed = await get();
    assert.equal(failed.status, 503);
    assert.deepEqual((await failed.json()).error, { code: 'SERVICE_UNAVAILABLE', message: 'Layanan belum tersedia. Silakan coba lagi.' });
    assert.equal((await fetch(`${root}/demo/availability`, { method: 'POST' })).status, 404);
  } finally { await app.close(); }
});
