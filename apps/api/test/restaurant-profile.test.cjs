const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RestaurantService, localScheduleDate } = require('../dist/restaurant/restaurant.service');

test('schedule date follows Jakarta midnight rather than UTC', () => {
  assert.equal(localScheduleDate(new Date('2026-10-29T16:59:59Z')), '2026-10-29');
  assert.equal(localScheduleDate(new Date('2026-10-29T17:00:00Z')), '2026-10-30');
});

test('public profile includes regular weekly hours for active tenant outlets', async () => {
  const service = new RestaurantService();
  const original = service.database;
  let query;
  const weeklyHours = [{ weekday: 1, openMinute: 600, closeMinute: 1320 }, { weekday: 0, openMinute: null, closeMinute: null }];
  service.database = { tenant: { findFirst: async input => {
    query = input;
    return { slug: 'demo-padang', name: 'Demo', outlets: [{ name: 'Demo Cikini', timezone: 'Asia/Jakarta', specialHours: [], weeklyHours }] };
  } } };
  try {
    const response = await service.info('demo-padang');
    assert.deepEqual(query.where, { slug: 'demo-padang', status: 'active' });
    assert.deepEqual(query.select.outlets.where, { isActive: true });
    assert.deepEqual(query.select.outlets.select.weeklyHours, { orderBy: { weekday: 'asc' }, select: { weekday: true, openMinute: true, closeMinute: true } });
    assert.deepEqual(response.data.outlets[0].weeklyHours, weeklyHours);
    assert.equal(response.source, 'restaurant_api');
    assert.equal(response.data.outlets[0].todayHours.timezone, 'Asia/Jakarta');
    assert.equal(query.select.outlets.select.specialHours.where.date.toISOString().slice(0, 10), response.data.outlets[0].todayHours.date);
    const weekday = new Date(`${response.data.outlets[0].todayHours.date}T00:00:00Z`).getUTCDay();
    for (const [specialHours, weekly, expected] of [
      [[], [{ weekday, openMinute: 480, closeMinute: 1260 }], { configured: true, source: 'weekly', openMinute: 480, closeMinute: 1260 }],
      [[{ openMinute: 600, closeMinute: 1200 }], [{ weekday, openMinute: 480, closeMinute: 1260 }], { configured: true, source: 'special', openMinute: 600, closeMinute: 1200 }],
      [[{ openMinute: null, closeMinute: null }], [{ weekday, openMinute: 480, closeMinute: 1260 }], { configured: true, source: 'special', openMinute: null, closeMinute: null }],
      [[], [], { configured: false, source: 'unconfigured', openMinute: null, closeMinute: null }],
    ]) {
      service.database.tenant.findFirst = async () => ({ slug: 'demo-padang', name: 'Demo', outlets: [{ timezone: 'Asia/Jakarta', specialHours, weeklyHours: weekly }] });
      const today = (await service.info('demo-padang')).data.outlets[0].todayHours;
      for (const key of Object.keys(expected)) assert.equal(today[key], expected[key]);
    }
  } finally {
    service.database = original;
    await service.onModuleDestroy();
  }
});
