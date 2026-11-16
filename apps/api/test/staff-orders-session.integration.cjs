const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { StaffOrdersService } = require('../dist/restaurant/staff-orders.service');
const { STAFF_IDLE_MS, STAFF_ABSOLUTE_MS } = require('../dist/auth/staff-session-policy');

const enabled = process.env.RUN_STAFF_DATABASE_TESTS === 'true';
const rollback = new Error('Rollback synthetic staff orders probe');
test('PostgreSQL guarded session update and tenant order snapshots', { skip: !enabled }, async () => {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Explicit loopback test database required');
  assert.ok(/test/i.test(url.pathname), 'Dedicated test database required');
  const db = createDatabaseClient();
  try {
    await assert.rejects(db.$transaction(async tx => {
      const now = new Date(), tenant = await tx.tenant.create({data:{slug:`staff-probe-${randomUUID()}`,name:'Synthetic staff probe'}});
      const other = await tx.tenant.create({data:{slug:`staff-probe-${randomUUID()}`,name:'Synthetic other probe'}});
      const staff = await tx.staff.create({data:{tenantId:tenant.id,username:'synthetic.staff',passwordHash:'unusable-synthetic-hash',role:'staff'}});
      const tokenHash = randomBytes(32).toString('hex');
      const session = await tx.staffSession.create({data:{tenantId:tenant.id,staffId:staff.id,tokenHash,createdAt:now,lastActivityAt:now,expiresAt:new Date(now.getTime()+STAFF_ABSOLUTE_MS)}});
      const repository = Object.create(StaffRepository.prototype); repository.database = { $transaction: run => run(tx) };
      const expiry = session.expiresAt.getTime();
      const accepted = await repository.activity(tokenHash, tenant.slug); assert.equal(accepted.count,1);
      const read = await tx.staffSession.findUnique({where:{id:session.id}}); assert.equal(read.expiresAt.getTime(),expiry);
      await tx.staffSession.update({where:{id:session.id},data:{lastActivityAt:new Date(now.getTime()-STAFF_IDLE_MS-1000)}});
      const late = await repository.activity(tokenHash,tenant.slug); assert.equal(late.count,0);
      assert.equal((await repository.activity(tokenHash,other.slug)).count,0);
      await tx.staffSession.update({where:{id:session.id},data:{revokedAt:now}});
      const concurrent = await Promise.all([repository.activity(tokenHash,tenant.slug),repository.activity(tokenHash,tenant.slug)]);
      assert.deepEqual(concurrent.map(result=>result.count),[0,0]);
      const order = await tx.order.create({data:{tenantId:tenant.id,code:`SYNTHETIC-${randomUUID()}`,customerName:'Synthetic guest',orderTotal:50000,items:[{name:'Synthetic dish',price:25000,quantity:2}],idempotencyKey:randomUUID(),snapToken:'synthetic-private-value'}});
      await tx.orderPaymentEvent.create({data:{tenantId:tenant.id,orderId:order.id,fromStatus:'unpaid',toStatus:'pending',createdAt:now}});
      const service = Object.create(StaffOrdersService.prototype); service.db = tx;
      const detail = await service.detail(tenant.id,order.id);
      assert.equal(detail.data.items[0].subtotal,50000); assert.equal(detail.data.paymentEvents.length,1);
      assert.equal(JSON.stringify(detail).includes('synthetic-private-value'),false);
      await assert.rejects(service.detail(other.id,order.id),error=>error.getStatus()===404);
      throw rollback;
    },{timeout:15000}),error=>error===rollback);
  } finally { await db.$disconnect(); }
});
