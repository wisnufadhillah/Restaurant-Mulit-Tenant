import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

test.beforeEach(async ({ context, request }) => {
  await request.post('http://127.0.0.1:3311/fixture/reset');
  await context.addCookies([
    { name: 'senja_staff', value: randomBytes(32).toString('base64url'), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
    { name: 'senja_staff_tenant', value: 'demo-padang', url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
  ]);
});

test('owner uploads file, previews, saves, reloads and clears photo with static fallback', async ({ page }) => {
  await page.goto('/dashboard?tab=menu');
  await expect(page.getByRole('link', { name: /Kategori menu/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Gambar', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Foto Renamed dish', exact: true })).toHaveAttribute('src', '/images/padang-rendang.webp');
  const edit = page.getByRole('button', { name: 'Edit Renamed dish', exact: true });
  await edit.click();
  await expect(page.getByRole('dialog', { name: 'Edit menu', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nama menu', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(edit).toBeFocused();
  await edit.click();
  const preview = page.locator('.sela-menu-image-preview');
  await expect(preview).toHaveAttribute('src', '/images/padang-rendang.webp');
  await expect(page.getByLabel('Foto tersimpan', { exact: true })).toHaveCount(0);
  expect(await preview.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await page.getByLabel('Unggah foto menu', { exact: true }).setInputFiles(resolve(__dirname, '../public/images/padang-rendang.webp'));
  await expect(preview).toHaveAttribute('src', /^blob:/);
  const saved = page.waitForResponse(response => response.url().includes('/staff/menu?id=') && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Simpan menu', exact: true }).click();
  const uploadedKey = (await saved).request().postDataJSON().imageKey;
  expect(uploadedKey).toMatch(/^upload-[a-f0-9]{48}\.webp$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Renamed dish', exact: true })).toBeFocused();
  await expect(page.getByText('Perubahan menu tersimpan.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Renamed dish', exact: true }).click();
  await expect(preview).toHaveAttribute('src', `/staff/menu/images?key=${uploadedKey}`);
  await expect(preview).toBeVisible();
  expect(await preview.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const publicPhoto = await page.request.get(`/menu-images/${uploadedKey}`); expect(publicPhoto.status()).toBe(200);
  await page.getByRole('button', { name: 'Hapus foto', exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole('button', { name: 'Simpan menu', exact: true }).click();
  await expect(page.getByText('Perubahan menu tersimpan.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Renamed dish', exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hapus foto', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah menu baru', exact: true }).click();
  await page.getByLabel('Nama menu', { exact: true }).fill('Synthetic new dish');
  await page.getByLabel('Harga (Rupiah)', { exact: true }).fill('25000');
  await page.getByLabel('Unggah foto menu', { exact: true }).setInputFiles(resolve(__dirname, '../public/images/padang-gulai.webp'));
  await page.getByRole('button', { name: 'Simpan menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Synthetic new dish', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Synthetic new dish', exact: true }).click();
  await expect(preview).toHaveAttribute('src', /^\/staff\/menu\/images\?key=upload-/);
});

test('staff sees availability only, legacy category tab opens menu and audit remains honest', async ({ page, request }) => {
  await request.post('http://127.0.0.1:3311/fixture/staff');
  await page.goto('/dashboard?tab=categories');
  await expect(page.getByRole('heading', { name: 'Katalog menu masakan' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Kategori menu/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tambah menu baru' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await expect(page.getByLabel('Unggah foto menu', { exact: true })).toHaveCount(0);
  const saved = page.waitForResponse(response => response.url().includes('availability=true'));
  await page.getByRole('button', { name: 'Tandai habis: Renamed dish', exact: true }).click();
  expect((await saved).request().postDataJSON()).toEqual({ isAvailable: false });
  await expect(page.getByRole('button', { name: 'Tandai tersedia: Renamed dish', exact: true })).toBeVisible();
  const forbidden = await page.request.patch('/staff/menu?id=30000000-0000-4000-8000-000000000001', { headers: { origin: 'http://127.0.0.1:3100' }, data: { imageKey: 'ayam-pop.jpg' } });
  expect(forbidden.status()).toBe(403);
  const navigation = page.getByRole('button', { name: 'Buka navigasi', exact: true });
  if (await navigation.isVisible()) await navigation.click();
  await page.getByRole('link', { name: /Audit aktivitas/ }).click();
  await expect(page.getByText('Belum ada aktivitas tercatat.', { exact: true })).toBeVisible();
});

test('upload BFF rejects missing session, bad Origin, staff, large bytes and unsafe read keys', async ({ page, context }) => {
  const request = page.request;
  const origin = 'http://127.0.0.1:3100';
  expect((await request.post('/staff/menu/images', { headers: { origin: 'https://untrusted.invalid', 'content-type': 'image/png' }, data: Buffer.from('invalid') })).status()).toBe(403);
  expect((await request.post('/staff/menu/images', { headers: { origin, 'content-type': 'image/png' }, data: Buffer.alloc(4_000_001) })).status()).toBe(413);
  expect((await request.get('/staff/menu/images?key=../unsafe.webp')).status()).toBe(404);
  await request.post('http://127.0.0.1:3311/fixture/staff');
  expect((await request.post('/staff/menu/images', { headers: { origin, 'content-type': 'image/png' }, data: Buffer.from('invalid') })).status()).toBe(403);
  await context.clearCookies();
  expect((await page.request.post('/staff/menu/images', { headers: { origin, 'content-type': 'image/png' }, data: Buffer.from('invalid') })).status()).toBe(401);
});

test('public catalogue uses stored image keys after rename and safe fallback for absent or invalid keys', async ({ page }) => {
  await page.route('**/reservation/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  const dish = page.locator('#menu article').filter({ has: page.getByRole('heading', { name: 'Renamed dish', exact: true }) });
  await expect(dish.locator('img')).toHaveAttribute('src', '/images/padang-rendang.webp');
  for (const name of ['Rendang sapi', 'Invalid photo']) {
    const fallback = page.locator('#menu article').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(fallback.locator('img')).toHaveCount(0);
    await expect(fallback.getByText('Foto hidangan belum tersedia')).toBeVisible();
  }
});
