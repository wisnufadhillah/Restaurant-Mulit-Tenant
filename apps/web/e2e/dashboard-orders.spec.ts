import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test.beforeEach(async ({ context, request }) => {
  await request.post('http://127.0.0.1:3311/fixture/reset');
  await context.addCookies([
    { name: 'senja_staff', value: randomBytes(32).toString('base64url'), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
    { name: 'senja_staff_tenant', value: 'demo-padang', url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
  ]);
});
test('readonly orders show safe list, keyboard detail, filters and pagination without page overflow', async ({ page }) => {
  await page.goto('/dashboard?tab=orders');
  await expect(page.getByRole('rowheader', { name: 'SYNTHETIC-ORDER', exact: true })).toBeVisible();
  await expect(page.getByText('Pemesan sintetis privat')).toHaveCount(0);
  const detail = page.getByRole('button', { name: 'Lihat detail SYNTHETIC-ORDER', exact: true });
  await detail.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Detail pesanan', exact: true })).toBeFocused();
  await expect(page.getByText('Pemesan sintetis privat')).toBeVisible();
  await expect(page.getByText('Hidangan sintetis', { exact: true })).toBeVisible();
  await expect(page.getByText('Menunggu pembayaran menjadi Lunas')).toBeVisible();
  await page.getByRole('button', { name: 'Tutup detail' }).click(); await expect(detail).toBeFocused();
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(page.getByText('Halaman 2', { exact: true })).toBeVisible();
  await page.getByLabel('Status pembayaran', { exact: true }).selectOption('pending');
  await page.getByRole('button', { name: 'Terapkan filter' }).click();
  await expect(page.getByText('Belum ada pesanan sesuai filter.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus filter' }).click();
  await expect(page.getByRole('rowheader', { name: 'SYNTHETIC-ORDER', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test('order loading and error stay distinct from empty, retry recovers', async ({ page, request }) => {
  await request.post('http://127.0.0.1:3311/fixture/orders-error');
  await page.goto('/dashboard?tab=orders');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Data pesanan belum dapat dimuat');
  await expect(page.getByText('Belum ada pesanan sesuai filter.', { exact: false })).toHaveCount(0);
  await request.post('http://127.0.0.1:3311/fixture/orders-empty');
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page.getByText('Belum ada pesanan sesuai filter.', { exact: false })).toBeVisible();
});
test('background checks never report activity; trusted keyboard activity is throttled', async ({ page, request }) => {
  await page.goto('/dashboard?tab=orders');
  await expect(page.getByRole('rowheader', { name: 'SYNTHETIC-ORDER', exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(async () => (await (await request.get('http://127.0.0.1:3311/fixture/activity')).json()).activityCount).toBe(0);
  await page.getByLabel('Tanggal pesanan (WIB)').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await expect.poll(async () => (await (await request.get('http://127.0.0.1:3311/fixture/activity')).json()).activityCount).toBe(1);
});
for (const failure of ['503', 'network', 'hung']) {
  test(`session ${failure} across deadline clears private detail without waiting for polling`, async ({ page, request }) => {
    const { validUntil } = await (await request.post('http://127.0.0.1:3311/fixture/deadline')).json();
    await page.clock.install({ time: new Date(validUntil - 10000) });
    await page.route('**/staff/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ validUntil }) }));
    const initial = page.waitForResponse(response => response.url().endsWith('/staff/session') && response.request().method() === 'GET');
    await page.goto('/dashboard?tab=orders'); await initial;
    await page.getByRole('button', { name: 'Lihat detail SYNTHETIC-ORDER', exact: true }).click();
    await expect(page.getByText('Pemesan sintetis privat')).toBeVisible();
    await page.clock.pauseAt(new Date(validUntil - 1));
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/staff/session', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      await pending;
      if (failure === 'network') await route.abort('failed');
      else await route.fulfill({ status: failure === 'hung' ? 200 : 503, contentType: 'application/json', body: JSON.stringify({ validUntil: validUntil + 1800000 }) });
    });
    const checking = page.waitForRequest(request => request.url().endsWith('/staff/session') && request.method() === 'GET');
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await checking;
    await page.clock.runFor(2);
    if (failure !== 'hung') release();
    if (failure === 'hung') await page.clock.runFor(1000);
    await expect(page.getByRole('heading', { name: 'Sesi berakhir', exact: true })).toBeVisible();
    await expect(page.getByText('Pemesan sintetis privat')).toHaveCount(0);
    if (failure === 'hung') release();
    await page.clock.runFor(15000);
    await expect(page.getByRole('heading', { name: 'Sesi berakhir', exact: true })).toBeVisible();
    await expect(page.getByText('Pemesan sintetis privat')).toHaveCount(0);
  });
}
test('deadline check accepts server-confirmed extension from another tab', async ({ page, request }) => {
  const { validUntil } = await (await request.post('http://127.0.0.1:3311/fixture/deadline')).json();
  await page.clock.install({ time: new Date(validUntil - 10000) });
  await page.route('**/staff/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ validUntil }) }));
  const initial = page.waitForResponse('**/staff/session');
  await page.goto('/dashboard?tab=orders'); await initial;
  await expect(page.getByRole('rowheader', { name: 'SYNTHETIC-ORDER', exact: true })).toBeVisible();
  await page.clock.pauseAt(new Date(validUntil - 1));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/staff/session', async route => {
    await pending; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ validUntil: validUntil + 1800000 }) });
  });
  const checking = page.waitForRequest('**/staff/session');
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await checking;
  await page.clock.runFor(2);
  const extended = page.waitForResponse('**/staff/session');
  release(); await extended;
  await new Promise(resolve => setTimeout(resolve, 50));
  await page.clock.runFor(1000);
  await expect(page.getByRole('rowheader', { name: 'SYNTHETIC-ORDER', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sesi berakhir', exact: true })).toHaveCount(0);
});
test('expired wake clears all tabs and late private response cannot restore data', async ({ page, context, request }) => {
  await page.goto('/dashboard?tab=orders');
  await page.getByRole('button', { name: 'Lihat detail SYNTHETIC-ORDER', exact: true }).click();
  await expect(page.getByText('Pemesan sintetis privat')).toBeVisible();
  const other = await context.newPage(); await other.goto('/dashboard?tab=menu');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/staff/orders?*', async route => { await pending; await route.fulfill({ contentType:'application/json', body:JSON.stringify({data:[{id:'late',code:'LATE-PRIVATE-ORDER',createdAt:'2026-11-10T05:00:00Z',orderTotal:1,status:'pending',paymentStatus:'pending'}],page:1,total:1}) }); });
  await page.bringToFront(); await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await request.post('http://127.0.0.1:3311/fixture/expire');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Sesi berakhir', exact: true })).toBeVisible();
  await expect(other.getByRole('heading', { name: 'Sesi berakhir', exact: true })).toBeVisible();
  release(); await expect(page.getByText('LATE-PRIVATE-ORDER')).toHaveCount(0);
  await expect(page.getByText('Pemesan sintetis privat')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Masuk kembali', exact: true })).toBeVisible();
});
