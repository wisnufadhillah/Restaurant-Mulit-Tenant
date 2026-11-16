const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { StaffOrdersController } = require('../dist/restaurant/staff-orders.controller');
const { StaffOrdersService } = require('../dist/restaurant/staff-orders.service');
const { StaffController } = require('../dist/auth/staff.controller');
const { StaffService } = require('../dist/auth/staff.service');
const { StaffRepository } = require('../dist/auth/staff.repository');
const { createSessionToken, hashSessionToken } = require('../dist/auth/crypto');
const { ApiErrorFilter } = require('../dist/http/error.filter');

test('HTTP orders and activity enforce active session, Origin, readonly methods and strict filters', async () => {
  const token = createSessionToken(), id = '50000000-0000-4000-8000-000000000001', now = Date.now();
  let reads = 0, touches = 0;
  const row = {tenantId:'tenant-a',staffId:'staff-a',createdAt:new Date(now),lastActivityAt:new Date(now),expiresAt:new Date(now+28800000),revokedAt:null,staff:{id:'staff-a',tenantId:'tenant-a',username:'synthetic.staff',role:'staff',isActive:true,tenant:{slug:'demo-a',status:'active'}}};
  const repository = {session:async hash=>hash===hashSessionToken(token)?row:null,activity:async()=>{touches++;return {count:1};}};
  const service = Object.create(StaffOrdersService.prototype);
  service.db = { $transaction:async callback=>callback({order:{findMany:async()=>{reads++;return [];},count:async()=>0}}),order:{findFirst:async()=>null} };
  class TestModule {}
  Module({controllers:[StaffOrdersController,StaffController],providers:[StaffService,{provide:StaffRepository,useValue:repository},{provide:StaffOrdersService,useValue:service}]})(TestModule);
  const app = await NestFactory.create(TestModule,{logger:false}); app.useGlobalFilters(new ApiErrorFilter());
  const original = process.env.STAFF_ORIGIN; process.env.STAFF_ORIGIN='http://127.0.0.1:3100';
  try {
    await app.listen(0,'127.0.0.1'); const root=`${await app.getUrl()}/staff/tenants/demo-a`,cookie=`restaurant_staff=${token}`;
    const get=(path,selected=cookie)=>fetch(`${root}${path}`,{headers:{cookie:selected}});
    assert.equal((await get('/orders','')).status,401); assert.equal(reads,0);
    for(const role of ['owner','staff']) {row.staff.role=role;const response=await get('/orders');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
    assert.equal(touches,0);
    for(const query of ['?date=2026-02-30','?page=1&page=2','?paymentStatus=paid','?tenantId=foreign']) assert.equal((await get(`/orders${query}`)).status,400);
    assert.equal((await get(`/orders/${id}`)).status,404);
    assert.equal((await fetch(`${root}/orders`,{method:'POST',headers:{cookie}})).status,404);
    const post=(origin,body='{}',type='application/json')=>fetch(`${root}/activity`,{method:'POST',headers:{cookie,origin,'content-type':type},body});
    assert.equal((await post('https://foreign.invalid')).status,403);assert.equal(touches,0);
    assert.equal((await post(process.env.STAFF_ORIGIN,'{}','text/plain')).status,403);
    assert.equal((await post(process.env.STAFF_ORIGIN,'{"timestamp":0}')).status,400);
    assert.equal((await post(process.env.STAFF_ORIGIN)).status,200); assert.equal(touches,1);
    row.lastActivityAt=new Date(Date.now()-1800000);
    assert.equal((await get('/orders')).status,401);assert.equal((await post(process.env.STAFF_ORIGIN)).status,401);assert.equal(touches,1);
    row.lastActivityAt=new Date();row.revokedAt=new Date();assert.equal((await get('/orders')).status,401);
    row.revokedAt=null;row.staff.role='visitor';assert.equal((await get('/orders')).status,401);
  } finally {if(original===undefined)delete process.env.STAFF_ORIGIN;else process.env.STAFF_ORIGIN=original;await app.close();}
});
