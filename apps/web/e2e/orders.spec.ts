import { test, expect, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function capture(page: Page, name: string) {
  const directory = process.env.BROWSER_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}-${test.info().project.name}.png`), fullPage: false });
}

const menuId = '00000000-0000-4000-8000-000000000001';
const menu = { id: menuId, name: 'Menu Sintetis', description: 'Menu uji', price: 5000, isAvailable: true };
const receipt = { id: '00000000-0000-4000-8000-000000000002', code: 'Pesanan Sintetis', orderTotal: 5000, paymentStatus: 'pending', redirectUrl: 'https://app.sandbox.midtrans.com/snap/demo' };

async function draft(page: Page) {
  const modelRequests: string[] = [], sessionMethods: string[] = [];
  await page.route('**/reservation/*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
  await page.route('**/chat/session', route => {
    sessionMethods.push(route.request().method());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/chat/catalogue/menu', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [menu] }) }));
  await page.route('**/chat/messages', route => {
    modelRequests.push(route.request().postData()!);
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/chat/orders/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: receipt }) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Tanya restoran', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah', exact: true }).click();
  await page.getByLabel('Nama pemesan').fill('Tamu Privat Sintetis');
  await capture(page, 'order-draft');
  return { modelRequests, sessionMethods };
}

test('lost order response retries immutable payload while edits and session reset stay guarded', async ({ page }) => {
  const { modelRequests, sessionMethods } = await draft(page);
  const attempts: string[] = [];
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/chat/orders', async route => {
    attempts.push(route.request().postData()!);
    if (attempts.length === 1) { await waiting; return route.abort('failed'); }
    if (attempts.length <= 3) return route.fulfill({ status: attempts.length === 2 ? 503 : 409, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: receipt }) });
  });
  await page.getByRole('button', { name: 'Buat Pesanan', exact: true }).click();
  await expect(page.getByLabel('Nama pemesan')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Coba ulang percobaan yang sama' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tambah', exact: true })).toHaveCount(0);
  expect(attempts).toHaveLength(1);
  release();
  await expect(page.getByText(/Hasil pesanan belum pasti\. Coba ulang hanya/)).toBeVisible();
  await expect(page.getByText(/Jangan muat ulang atau tutup halaman/)).toBeVisible();
  await capture(page, 'order-recovery');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await page.getByLabel('Pesan untuk asisten').fill('Menu sintetis?');
  await page.getByLabel('Pesan untuk asisten').press('Enter');
  await expect(page.getByRole('button', { name: 'Mulai sesi baru' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tutup chat' }).click();
  await page.getByRole('button', { name: 'Tanya restoran', exact: true }).click();
  expect(sessionMethods).toEqual(['POST']);
  for (let retry = 0; retry < 2; retry++) {
    await page.getByRole('button', { name: 'Coba ulang percobaan yang sama' }).click();
    await expect(page.getByRole('button', { name: 'Coba ulang percobaan yang sama' })).toBeEnabled();
    await expect(page.getByLabel('Nama pemesan')).toBeDisabled();
    await expect(page.getByText(/hubungi restoran untuk pemeriksaan manual/)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Coba ulang percobaan yang sama' }).click();
  await expect(page.getByRole('button', { name: 'Bayar Sekarang' })).toBeVisible();
  await capture(page, 'order-ready');
  expect(attempts).toHaveLength(4);
  expect(new Set(attempts).size).toBe(1);
  expect(JSON.parse(attempts[0])).toEqual({ customerName: 'Tamu Privat Sintetis', items: [{ id: menuId, quantity: 1 }], idempotencyKey: expect.any(String) });
  expect(modelRequests).toEqual([JSON.stringify({ message: 'Menu sintetis?' })]);
  await expect(page.getByRole('log')).not.toContainText('Tamu Privat Sintetis');
  await expect(page.getByRole('log')).not.toContainText(receipt.code);
  await expect(page.getByRole('log')).not.toContainText(receipt.redirectUrl);
  const storage = await page.evaluate(() => JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }));
  expect(storage).not.toContain('Tamu Privat Sintetis');
  expect(storage).not.toContain(receipt.redirectUrl);
});

test('first validation rejection permits correction but later rejection never discards unknown intent', async ({ page }) => {
  await draft(page);
  const attempts: { customerName: string; idempotencyKey: string; items: unknown[] }[] = [];
  await page.route('**/chat/orders', route => {
    attempts.push(route.request().postDataJSON());
    return route.fulfill({ status: attempts.length === 2 ? 503 : 400, contentType: 'application/json', body: '{}' });
  });
  await page.getByRole('button', { name: 'Buat Pesanan', exact: true }).click();
  await expect(page.getByLabel('Nama pemesan')).toBeEnabled();
  await expect(page.getByText(/Detail pesanan ditolak/)).toBeVisible();
  await page.getByLabel('Nama pemesan').fill('Tamu Koreksi Sintetis');
  await page.getByRole('button', { name: 'Tambah', exact: true }).click();
  await page.getByRole('button', { name: 'Buat Pesanan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Coba ulang percobaan yang sama' })).toBeEnabled();
  await page.getByRole('button', { name: 'Coba ulang percobaan yang sama' }).click();
  await expect(page.getByLabel('Nama pemesan')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Buat Pesanan', exact: true })).toHaveCount(0);
  expect(attempts).toHaveLength(3);
  expect(attempts[0].idempotencyKey).not.toBe(attempts[1].idempotencyKey);
  expect(attempts[1]).toEqual(attempts[2]);
  expect(attempts[1].customerName).toBe('Tamu Koreksi Sintetis');
  expect(attempts[1].items).toEqual([{ id: menuId, quantity: 2 }]);
});

test('lost status access retains known order and cannot reopen creation', async ({ page }) => {
  await draft(page);
  await page.route('**/chat/orders', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: receipt }) }));
  await page.route('**/chat/orders/*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Buat Pesanan', exact: true }).click();
  await expect(page.getByText(/Pesanan tetap tersimpan/)).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole('button', { name: 'Buat Pesanan', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tambah', exact: true })).toHaveCount(0);
  await expect(page.getByRole('log')).not.toContainText('Tamu Privat Sintetis');
});
