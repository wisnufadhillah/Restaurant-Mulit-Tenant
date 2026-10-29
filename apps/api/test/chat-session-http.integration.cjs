const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/create-app');

test('chat cookie session reuses valid context and revokes without exposing bearer in JSON', async () => {
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api/v1/chat/session`;
    assert.equal((await fetch(base)).status, 403);
    assert.equal((await fetch(base, { method: 'POST' })).status, 403);
    const create = await fetch(base, { method: 'POST', headers: { origin: 'http://127.0.0.1:3000' } });
    assert.equal(create.status, 200);
    const raw = create.headers.get('set-cookie');
    assert.ok(raw.includes('HttpOnly') && raw.includes('SameSite=Strict'));
    const cookie = raw.split(';')[0], body = await create.json();
    assert.equal(body.data.token, undefined);
    assert.ok(!JSON.stringify(body).includes(cookie.slice(cookie.indexOf('=') + 1)));
    const catalogueBase = `${await app.getUrl()}/api/v1/chat/catalogue`;
    assert.equal((await fetch(`${catalogueBase}/menu`)).status, 403);
    const menu = await fetch(`${catalogueBase}/menu`, { headers: { cookie } });
    assert.equal(menu.status, 200); assert.ok(Array.isArray((await menu.json()).data));
    assert.equal((await fetch(`${catalogueBase}/restaurant`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${catalogueBase}/hours`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${catalogueBase}/sql`, { headers: { cookie } })).status, 404);
    const read = await fetch(base, { headers: { cookie } }); assert.equal(read.status, 200);
    assert.deepEqual(await read.json(), body);
    const reuse = await fetch(base, { method: 'POST', headers: { cookie, origin: 'http://127.0.0.1:3000' } });
    assert.deepEqual(await reuse.json(), body); assert.equal(reuse.headers.get('set-cookie'), null);
    assert.equal((await fetch(base, { headers: { cookie: `${cookie}; ${cookie}` } })).status, 403);
    assert.equal((await fetch(base, { method: 'DELETE', headers: { cookie, origin: 'https://other.example' } })).status, 403);
    assert.equal((await fetch(base, { method: 'DELETE', headers: { cookie, origin: 'http://127.0.0.1:3000' } })).status, 204);
    assert.equal((await fetch(base, { headers: { cookie } })).status, 403);
    assert.equal((await fetch(`${catalogueBase}/menu`, { headers: { cookie } })).status, 403);
    assert.equal((await fetch(base, { method: 'DELETE', headers: { cookie, origin: 'http://127.0.0.1:3000' } })).status, 204);
    assert.equal((await fetch(base, { method: 'DELETE', headers: { origin: 'http://127.0.0.1:3000' } })).status, 204);
  } finally { await app.close(); }
});
