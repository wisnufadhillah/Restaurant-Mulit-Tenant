const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hoursInput } = require('../dist/restaurant/hours.service');
test('weekly hours permit closed days and one same-day interval only', () => {
  assert.deepEqual(hoursInput({ weekday: 0, openMinute: null, closeMinute: null }), { weekday: 0, openMinute: null, closeMinute: null });
  assert.equal(hoursInput({ weekday: 6, openMinute: 0, closeMinute: 1440 }).closeMinute, 1440);
  for (const body of [{ weekday: 7, openMinute: 600, closeMinute: 1200 }, { weekday: 1, openMinute: 1200, closeMinute: 600 }, { weekday: 1, openMinute: 600, closeMinute: 600 }, { weekday: 1, openMinute: null, closeMinute: 600 }, { weekday: 1, openMinute: 600.5, closeMinute: 1200 }, { weekday: 1, openMinute: 0, closeMinute: 1441 }, { weekday: 1, openMinute: 600, closeMinute: 1200, tenantId: 'other' }]) assert.throws(() => hoursInput(body), error => error.getStatus() === 400);
});
