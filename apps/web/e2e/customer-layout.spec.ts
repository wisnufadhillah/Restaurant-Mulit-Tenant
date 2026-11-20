import { test, expect, Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function reachable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  expect(await control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
}

test('customer footer and order controls remain readable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('**/reservation/*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
  await page.route('**/chat/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/chat/orders/capabilities', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { paymentsEnabled: true } }) }));
  await page.route('**/chat/catalogue/menu', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Rendang demo', price: 35000, description: 'Menu sintetis', isAvailable: true }] }) }));
  await page.goto('/');
  await expect(page.locator('.senja-footer address')).not.toBeEmpty();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Tanya restoran', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const add = page.getByRole('button', { name: 'Tambah ke Pesanan', exact: true });
  expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await add.click();
  await add.click();
  await expect(page.locator('.sela-order-line')).toContainText('× 2');
  await page.getByRole('button', { name: 'Kurangi satu Rendang demo', exact: true }).click();
  await expect(page.locator('.sela-order-line')).toContainText('× 1');
  const name = page.getByLabel('Nama pemesan', { exact: true });
  await expect(name).toBeVisible();
  expect(await name.evaluate(element => getComputedStyle(element).fontSize)).toBe('16px');
  expect((await name.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const create = page.getByRole('button', { name: 'Lanjut ke pembayaran', exact: true });
  await create.scrollIntoViewIfNeeded();
  expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const send = page.getByRole('button', { name: 'Kirim', exact: true });
  await send.scrollIntoViewIfNeeded();
  await expect(send).toBeVisible();
  const bounds = (await send.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(640);
  await page.getByRole('button', { name: 'Hapus Rendang demo', exact: true }).click();
  await expect(page.getByLabel('Nama pemesan', { exact: true })).toHaveCount(0);
});

test('compact mobile long cart keeps conversation, input, controls and retry reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const menu = Array.from({ length: 6 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name: `Menu sintetis ${index + 1} dengan nama panjang`, description: 'Fixture lokal, bukan menu atau transaksi nyata.', price: 5000, isAvailable: true }));
  await page.route('**/reservation/*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
  await page.route('**/chat/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/chat/orders/capabilities', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { paymentsEnabled: true } }) }));
  await page.route('**/chat/catalogue/menu', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: menu }) }));
  const attempts: string[] = [];
  await page.route('**/chat/orders', route => { attempts.push(route.request().postData()!); return route.abort('failed'); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tanya restoran', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  for (let index = 0; index < menu.length; index++) await page.getByRole('button', { name: 'Tambah ke Pesanan', exact: true }).nth(index).click();
  const orderArea = page.locator('.sela-chat-order-area');
  expect(await orderArea.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const composerBefore = (await page.locator('.sela-chat-composer').boundingBox())!;
  await orderArea.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const composerAfter = (await page.locator('.sela-chat-composer').boundingBox())!;
  expect(composerAfter.y).toBeCloseTo(composerBefore.y, 1);
  expect(composerAfter.y + composerAfter.height).toBeLessThanOrEqual(640);
  expect(await page.locator('.sela-chat-footer').evaluate(element => getComputedStyle(element).overflowY)).toBe('hidden');
  const panel = (await page.getByRole('dialog').boundingBox())!;
  const footer = (await page.locator('.sela-chat-footer').boundingBox())!;
  expect(footer.height).toBeLessThanOrEqual(panel.height * .56);
  expect((await page.getByRole('log').boundingBox())!.height).toBeGreaterThan(180);
  for (const item of menu) {
    const remove = page.getByRole('button', { name: `Hapus ${item.name}`, exact: true });
    await reachable(remove);
    expect((await remove.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await reachable(page.getByLabel('Nama pemesan', { exact: true }));
  await page.getByLabel('Nama pemesan', { exact: true }).fill('Tamu Sintetis');
  const input = page.getByLabel('Pesan untuk asisten', { exact: true });
  await reachable(input);
  await input.fill('Pertanyaan sintetis, tidak dikirim');
  await reachable(page.getByRole('button', { name: 'Kirim', exact: true }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'mobile' && process.env.CAPTURE_COMPACT_MOBILE === '1') {
    const directory = resolve('docs/images/chatbot-mentor');
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, 'after-mobile.png'), fullPage: false });
  }
  const checkout = page.getByRole('button', { name: 'Lanjut ke pembayaran', exact: true });
  await reachable(checkout);
  await checkout.click();
  const retry = page.getByRole('button', { name: 'Coba ulang percobaan yang sama', exact: true });
  await expect(retry).toBeEnabled();
  await reachable(retry);
  await retry.click();
  await expect(retry).toBeEnabled();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toBe(attempts[1]);
  await reachable(input);
  await expect(input).toHaveValue('Pertanyaan sintetis, tidak dikirim');
  await expect(page.getByRole('log')).not.toContainText('Tamu Sintetis');
});
