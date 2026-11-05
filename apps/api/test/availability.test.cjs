const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateAvailability, reservationWindow, customerCancellationAllowed } = require('../dist/restaurant/availability');

const now = new Date('2026-11-02T02:00:00.000Z');
const policy = { timezone: 'Asia/Jakarta', durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, maxPartySize: 12, cancelCutoffMinutes: 120 };
const snapshot = () => ({
  policy,
  weeklyHours: [{ weekday: 1, openMinute: 600, closeMinute: 1320 }],
  specialHours: [],
  tables: [{ id: 'large', capacity: 6, isActive: true }, { id: 'small', capacity: 4, isActive: true }],
  reservations: [],
});

test('availability returns smallest fitting table and an absolute ninety minute interval', () => {
  const result = calculateAvailability({ date: '2026-11-02', time: '10:00', partySize: 4 }, snapshot(), now);
  assert.equal(result.available, true);
  assert.equal(result.tableId, 'small');
  assert.equal(result.startAt, '2026-11-02T03:00:00.000Z');
  assert.equal(result.endAt, '2026-11-02T04:30:00.000Z');
  assert.equal(result.held, false);
});

test('time validation enforces strict dates, guest bounds, notice and rolling advance limit', () => {
  const request = { date: '2026-11-02', time: '10:00', partySize: 4 };
  for (const input of [null, [], { ...request, tenantId: 'other' }, { ...request, date: '2026-02-30' }, { ...request, date: '02/11/2026' }, { ...request, time: '24:00' }, { ...request, time: '10:00:00' }, { ...request, time: '9:00' }, { ...request, partySize: '4' }, { ...request, partySize: true }, { ...request, partySize: 0 }, { ...request, partySize: 13 }, { ...request, partySize: 1.5 }, { ...request, date: '2026-11-01' }, { ...request, time: '09:59' }]) {
    assert.throws(() => reservationWindow(input, policy, now), error => error.getStatus() === 400);
  }
  assert.equal(reservationWindow(request, policy, now).startAt.toISOString(), '2026-11-02T03:00:00.000Z');
  assert.equal(reservationWindow({ date: '2026-12-02', time: '09:00', partySize: 1 }, policy, now).startAt.toISOString(), '2026-12-02T02:00:00.000Z');
  assert.throws(() => reservationWindow({ date: '2026-12-02', time: '09:01', partySize: 1 }, policy, now), error => error.getStatus() === 400);
});

test('date conversion uses Jakarta midnight and accepts valid leap days only', () => {
  const midnight = reservationWindow({ date: '2026-11-03', time: '00:00', partySize: 1 }, policy, new Date('2026-11-02T15:00:00Z'));
  assert.equal(midnight.startAt.toISOString(), '2026-11-02T17:00:00.000Z');
  assert.equal(midnight.weekday, 2);
  assert.equal(reservationWindow({ date: '2028-02-29', time: '12:00', partySize: 1 }, policy, new Date('2028-02-28T00:00:00Z')).date, '2028-02-29');
  assert.throws(() => reservationWindow({ date: '2027-02-29', time: '12:00', partySize: 1 }, policy, new Date('2027-02-28T00:00:00Z')), error => error.getStatus() === 400);
});

test('special hours override weekly hours and distinguish closed from unconfigured', () => {
  const state = snapshot(), request = { date: '2026-11-02', time: '10:00', partySize: 4 };
  state.specialHours = [{ date: request.date, openMinute: null, closeMinute: null }];
  assert.equal(calculateAvailability(request, state, now).reason, 'closed');
  state.specialHours = [{ date: request.date, openMinute: 720, closeMinute: 1320 }];
  assert.equal(calculateAvailability(request, state, now).reason, 'outside_hours');
  state.specialHours = [{ date: '2026-11-03', openMinute: null, closeMinute: null }];
  assert.equal(calculateAvailability(request, state, now).available, true);
  state.weeklyHours = [];
  assert.equal(calculateAvailability(request, state, now).reason, 'hours_unconfigured');
});

test('entire visit must fit operating hours and can end exactly at midnight', () => {
  const state = snapshot();
  assert.equal(calculateAvailability({ date: '2026-11-02', time: '20:30', partySize: 4 }, state, now).available, true);
  assert.equal(calculateAvailability({ date: '2026-11-02', time: '20:31', partySize: 4 }, state, now).reason, 'outside_hours');
  state.weeklyHours[0] = { weekday: 1, openMinute: 0, closeMinute: 1440 };
  const result = calculateAvailability({ date: '2026-11-02', time: '22:30', partySize: 4 }, state, now);
  assert.equal(result.available, true);
  assert.equal(result.endAt, '2026-11-02T17:00:00.000Z');
  assert.equal(calculateAvailability({ date: '2026-11-02', time: '22:31', partySize: 4 }, state, now).reason, 'outside_hours');
});

test('confirmed overlaps block allocation while adjacent and terminal intervals do not', () => {
  const request = { date: '2026-11-02', time: '10:00', partySize: 4 };
  for (const [startAt, endAt] of [['2026-11-02T02:00Z', '2026-11-02T03:01Z'], ['2026-11-02T03:01Z', '2026-11-02T04:00Z'], ['2026-11-02T04:29Z', '2026-11-02T05:00Z'], ['2026-11-02T02:00Z', '2026-11-02T05:00Z']]) {
    const state = snapshot();
    state.reservations = [{ tableId: 'small', startAt: new Date(startAt), endAt: new Date(endAt), status: 'confirmed' }];
    assert.equal(calculateAvailability(request, state, now).tableId, 'large');
  }
  for (const [startAt, endAt, status] of [['2026-11-02T02:00Z', '2026-11-02T03:00Z', 'confirmed'], ['2026-11-02T04:30Z', '2026-11-02T05:00Z', 'confirmed'], ...['cancelled', 'completed', 'no_show'].map(status => ['2026-11-02T02:00Z', '2026-11-02T05:00Z', status])]) {
    const state = snapshot();
    state.reservations = [{ tableId: 'small', startAt: new Date(startAt), endAt: new Date(endAt), status }];
    assert.equal(calculateAvailability(request, state, now).tableId, 'small');
  }
});

test('allocation excludes inactive or insufficient tables and uses stable tie breaking', () => {
  const state = snapshot(), request = { date: '2026-11-02', time: '10:00', partySize: 4 };
  state.tables = [{ id: 'inactive', capacity: 4, isActive: false }, { id: 'tiny', capacity: 2, isActive: true }];
  assert.equal(calculateAvailability(request, state, now).reason, 'no_table');
  state.tables = [{ id: 'b', capacity: 4, isActive: true }, { id: 'a', capacity: 4, isActive: true }];
  assert.equal(calculateAvailability(request, state, now).tableId, 'a');
  state.reservations = state.tables.map(table => ({ tableId: table.id, startAt: new Date('2026-11-02T03:00Z'), endAt: new Date('2026-11-02T04:30Z'), status: 'confirmed' }));
  assert.equal(calculateAvailability(request, state, now).reason, 'no_table');
});

test('customer cancellation accepts exact cutoff and rejects later times', () => {
  const start = new Date('2026-11-02T05:00Z');
  assert.equal(customerCancellationAllowed(start, policy, new Date('2026-11-02T03:00Z')), true);
  assert.equal(customerCancellationAllowed(start, policy, new Date('2026-11-02T03:00:00.001Z')), false);
  assert.equal(customerCancellationAllowed(start, policy, new Date('2026-11-02T06:00Z')), false);
  assert.throws(() => customerCancellationAllowed(new Date('invalid'), policy, now));
});

test('invalid trusted configuration fails closed rather than suggesting a table', () => {
  const request = { date: '2026-11-02', time: '10:00', partySize: 4 };
  for (const key of ['timezone', 'durationMinutes', 'minNoticeMinutes', 'maxAdvanceDays', 'maxPartySize', 'cancelCutoffMinutes']) {
    assert.throws(() => reservationWindow(request, { ...policy, [key]: key === 'timezone' ? 'UTC' : -1 }, now), /Unsupported reservation policy/);
  }
  assert.throws(() => reservationWindow(request, policy, new Date('invalid')));
  const state = snapshot();
  state.weeklyHours.push({ weekday: 1, openMinute: null, closeMinute: null });
  assert.throws(() => calculateAvailability(request, state, now), /Ambiguous/);
  state.weeklyHours = [{ weekday: 1, openMinute: null, closeMinute: 1320 }];
  assert.throws(() => calculateAvailability(request, state, now), /Invalid operating/);
  state.weeklyHours = [{ weekday: 1, openMinute: 600, closeMinute: 1320 }];
  state.reservations = [{ tableId: 'small', startAt: new Date('invalid'), endAt: now, status: 'confirmed' }];
  assert.throws(() => calculateAvailability(request, state, now), /Invalid confirmed/);
});
