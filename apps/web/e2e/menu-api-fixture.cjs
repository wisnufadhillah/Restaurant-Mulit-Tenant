const { createServer } = require('node:http');

function startMenuFixture() {
  let role = 'owner';
  let items, reservationStatus = 'confirmed', events = [];
  const attempts = new Map();
  const uploads = new Map();
  const reset = () => { items = [
    { id: '30000000-0000-4000-8000-000000000001', name: 'Renamed dish', description: 'Synthetic menu', price: 35000, isActive: true, isAvailable: true, imageKey: 'padang-rendang.webp' },
    { id: '30000000-0000-4000-8000-000000000002', name: 'Rendang sapi', description: 'No photo selected', price: 35000, isActive: true, isAvailable: true, imageKey: null },
    { id: '30000000-0000-4000-8000-000000000003', name: 'Invalid photo', description: '', price: 10000, isActive: true, isAvailable: true, imageKey: '../unsafe.jpg' },
  ]; };
  reset();
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    const reply = (status, data) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(data)); };
    if (path === '/health') return reply(200, { ready: true });
    if (path === '/fixture/reset' && request.method === 'POST') { role = 'owner'; reservationStatus = 'confirmed'; events = []; attempts.clear(); reset(); return reply(200, { ok: true }); }
    if (path === '/fixture/staff' && request.method === 'POST') { role = 'staff'; return reply(200, { ok: true }); }
    if (path.endsWith('/session')) return reply(200, { data: { username: `synthetic.${role}`, role } });
    if (path === '/api/v1/public/tenants/demo-padang/restaurant') return reply(200, { data: { name: 'Dapur Sela', outlets: [{ address: 'Synthetic address', contactPhone: '' }] } });
    if (path === '/api/v1/public/tenants/demo-padang/hours') return reply(200, { data: [], timezone: 'Asia/Jakarta' });
    if (path === '/api/v1/public/tenants/demo-padang/menu/catalogue') return reply(200, { data: items.filter(item => item.isActive), source: 'restaurant_api' });
    const staffRoot = '/api/v1/staff/tenants/demo-padang';
    if (path === `${staffRoot}/reservations/40000000-0000-4000-8000-000000000001/transitions` && request.method === 'POST') {
      let text = ''; for await (const chunk of request) text += chunk;
      const body = JSON.parse(text), key = request.headers['idempotency-key'];
      if (attempts.has(key)) return reply(attempts.get(key).body === text ? 200 : 409, attempts.get(key).receipt);
      if (reservationStatus !== 'confirmed') return reply(409, {});
      reservationStatus = body.status;
      const createdAt = new Date().toISOString(), reservationId = '40000000-0000-4000-8000-000000000001';
      const receipt = { data: { reservationId, status: body.status, eventId: key, changedAt: createdAt } };
      attempts.set(key, { body: text, receipt });
      events.unshift({ id: key, source: 'reservation', createdAt, action: `reservation.${body.status}`, actorType: 'staff', reservationId, fromStatus: 'confirmed', toStatus: body.status });
      return reply(200, receipt);
    }
    if (request.method === 'GET') {
      if (path === `${staffRoot}/audit`) { const page = Number(new URL(request.url, 'http://127.0.0.1').searchParams.get('page') || 1); return reply(200, { data: events.slice((page - 1) * 20, page * 20), page, pageSize: 20, total: events.length }); }
      if (path === `${staffRoot}/profile`) return reply(200, { data: { name: 'Dapur Sela', outletName: 'Lokasi sintetis', address: 'Alamat pengujian sintetis', contactPhone: '' } });
      if (path === `${staffRoot}/tables`) return reply(200, { data: [{ id: 'table-synthetic', name: 'Meja sintetis', capacity: 4, isActive: true }] });
      if (path === `${staffRoot}/hours`) return reply(200, { data: [{ weekday: 1, openMinute: 660, closeMinute: 1260 }] });
      if (path === `${staffRoot}/special-hours`) return reply(200, { data: [{ date: '2027-01-01', openMinute: null, closeMinute: null }] });
      if (path === `${staffRoot}/reservations`) return reply(200, { data: [{ id: '40000000-0000-4000-8000-000000000001', referenceCode: 'SYNTHETIC-RESERVATION', guestName: 'Tamu sintetis', partySize: 2, startAt: '2027-01-04T05:00:00.000Z', endAt: '2027-01-04T06:00:00.000Z', status: reservationStatus, table: { name: 'Meja sintetis' }, outlet: { name: 'Lokasi sintetis' } }], page: 1, total: 1 });
      if (path === `${staffRoot}/reservations/40000000-0000-4000-8000-000000000001`) return reply(200, { data: { id: '40000000-0000-4000-8000-000000000001', referenceCode: 'SYNTHETIC-RESERVATION', guestName: 'Tamu sintetis', guestPhone: 'Kontak sintetis', partySize: 2, startAt: '2027-01-04T05:00:00.000Z', endAt: '2027-01-04T06:00:00.000Z', status: reservationStatus, table: { name: 'Meja sintetis' }, outlet: { name: 'Lokasi sintetis' } } });
    }
    const root = `${staffRoot}/menu`;
    if (path === `${root}/images` && request.method === 'POST') {
      if (role !== 'owner') return reply(403, {});
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const key = `upload-${require('node:crypto').randomBytes(24).toString('hex')}.webp`;
      uploads.set(key, Buffer.concat(chunks)); return reply(201, { data: { imageKey: key } });
    }
    if (path.includes('/menu/images/') && request.method === 'GET') {
      const key = path.split('/').at(-1), bytes = uploads.get(key);
      if (!bytes || (path.includes('/public/') && !items.some(item => item.isActive && item.imageKey === key))) return reply(404, {});
      response.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' }); return response.end(bytes);
    }
    if (path === root && request.method === 'GET') return reply(200, { data: items });
    if (path.startsWith(root) && ['POST', 'PATCH'].includes(request.method)) {
      const availability = path.endsWith('/availability');
      if (role !== 'owner' && !availability) return reply(403, { message: 'Owner required' });
      let text = ''; for await (const chunk of request) text += chunk;
      const body = JSON.parse(text);
      if (availability && Object.keys(body).join() !== 'isAvailable') return reply(400, { message: 'Availability only' });
      if (request.method === 'POST') { const item = { id: '30000000-0000-4000-8000-000000000004', ...body }; items.push(item); return reply(201, { data: item }); }
      const item = items.find(item => item.id === path.slice(root.length + 1).split('/')[0]);
      if (!item) return reply(404, {});
      Object.assign(item, body); return reply(200, { ok: true });
    }
    return reply(404, { message: 'Synthetic endpoint unavailable' });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(3311, '127.0.0.1', () => resolve(server));
  });
}
module.exports = { startMenuFixture };

if (require.main === module) {
  startMenuFixture().then(server => {
    console.info('Synthetic menu API ready on loopback.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
  }).catch(() => { console.error('Synthetic menu API could not bind; existing service left untouched.'); process.exitCode = 1; });
}
