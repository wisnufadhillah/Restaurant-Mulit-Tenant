const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StaffOrdersService, staffOrderQuery, staffOrderItems } = require('../dist/restaurant/staff-orders.service');
const { StaffOrdersController } = require('../dist/restaurant/staff-orders.controller');
const bad = error => error.getStatus() === 400;
test('order filters strictly validate dates, payment statuses and pagination in WIB', () => {
  const query = staffOrderQuery({ date: '2026-11-10', paymentStatus: 'settlement', page: '2' });
  assert.equal(query.createdAt.gte.toISOString(), '2026-11-09T17:00:00.000Z');
  assert.equal(query.createdAt.lt.toISOString(), '2026-11-10T17:00:00.000Z');
  assert.equal(query.page, 2);
  for (const query of [{ date: '2026-02-30' }, { date: ['2026-11-10'] }, { paymentStatus: 'paid' }, { page: '0' }, { page: ['1','2'] }, { tenantId: 'foreign' }, { status: 'confirmed' }]) assert.throws(() => staffOrderQuery(query), bad);
});
test('order snapshots whitelist only item name, quantity, price and subtotal', () => {
  assert.deepEqual(staffOrderItems([{ id: 'opaque', name: 'Synthetic dish', price: 25000, quantity: 2, snapToken: 'forbidden-synthetic' }]), [{ name: 'Synthetic dish', price: 25000, quantity: 2, subtotal: 50000 }]);
});
test('list scopes tenant, selects safe fields, and reads deterministic 20-row pages with count', async () => {
  const service = Object.create(StaffOrdersService.prototype);
  service.db = { $transaction: async (run, options) => {
    assert.equal(options.isolationLevel, 'RepeatableRead');
    return run({ order: { findMany: async args => {
      assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.take, 20); assert.equal(args.skip, 20);
      assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
      assert.deepEqual(Object.keys(args.select).sort(), ['code','createdAt','id','orderTotal','paymentStatus','status']); return [];
    }, count: async ({where}) => { assert.equal(where.tenantId, 'tenant-a'); return 25; } } });
  } };
  assert.deepEqual(await service.list('tenant-a', { page: '2' }), { data: [], page: 2, pageSize: 20, total: 25 });
});
test('detail scopes order and events; unknown tenant order returns same not found; response excludes private extras', async () => {
  const id = '50000000-0000-4000-8000-000000000001', service = Object.create(StaffOrdersService.prototype);
  service.db = { order: { findFirst: async ({where, select}) => {
    assert.deepEqual(where, {tenantId: 'tenant-a', id});
    assert.deepEqual(select.paymentEvents.where, {tenantId: 'tenant-a', orderId: id});
    assert.deepEqual(select.paymentEvents.orderBy, [{createdAt: 'asc'}, {id: 'asc'}]);
    assert.equal(select.snapToken, undefined); assert.equal(select.customerPhone, undefined);
    return { id, code: 'SYNTHETIC-ORDER', createdAt: new Date(), orderTotal: 50000, status: 'pending', paymentStatus: 'pending', customerName: 'Synthetic guest', snapToken: 'forbidden-synthetic', customerPhone: 'forbidden-synthetic', items: [{name:'Dish',price:25000,quantity:2}], paymentEvents: [{id:'event',fromStatus:'unpaid',toStatus:'pending',createdAt:new Date(),payload:'forbidden-synthetic'}] };
  } } };
  const result = await service.detail('tenant-a', id);
  assert.equal(JSON.stringify(result).includes('forbidden-synthetic'), false);
  assert.equal(result.data.items[0].subtotal, result.data.orderTotal);
  service.db.order.findFirst = async () => null;
  await assert.rejects(service.detail('tenant-b', id), error => error.getStatus() === 404);
});
test('staff orders controller derives tenant only from authenticated actor', async () => {
  let tenant;
  const controller = new StaffOrdersController({ list: async id => { tenant = id; return {data:[]}; } }, { authenticate: async (_token, slug) => { assert.equal(slug, 'demo-a'); return {tenantId:'tenant-a'}; } });
  const response = {setHeader: (_key, value) => assert.equal(value, 'no-store')};
  await controller.list('demo-a', {}, {headers:{},socket:{}}, response);
  assert.equal(tenant, 'tenant-a');
});
