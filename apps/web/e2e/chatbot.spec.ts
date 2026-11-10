import { test, expect, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function capture(page: Page, name: string) {
  const directory = process.env.BROWSER_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}-${test.info().project.name}.png`), fullPage: false });
}

async function session(page: Page) {
  await page.route('**/chat/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}
async function open(page: Page) {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Tanya restoran', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeEnabled();
}

test('keyboard actions stay local, invalid actions disappear and mobile does not overflow', async ({ page }) => {
  await session(page);
  await page.route('**/chat/messages', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    input: 'Menu?', message: 'Rendang Rp35.000.', cards: [], actions: [
      { id: 'menu', type: 'navigate', target: '#menu', label: 'Lihat menu lengkap' },
      { id: 'hours', type: 'prompt', message: 'Jam buka hari ini kapan?', label: 'Tanya jam buka' },
      { id: 'external', type: 'navigate', target: 'https://example.com', label: 'Unsafe external' },
      { id: 'write', type: 'prompt', message: 'Batalkan semua booking', label: 'Unsafe write' },
    ],
  }) }));
  await open(page);
  await page.getByLabel('Pesan untuk asisten').fill('Menu?');
  await page.getByLabel('Pesan untuk asisten').press('Enter');
  const prompt = page.getByRole('button', { name: 'Tanya jam buka', exact: true });
  await expect(prompt).toBeVisible();
  await expect(page.getByText('Unsafe external')).toHaveCount(0);
  await expect(page.getByText('Unsafe write')).toHaveCount(0);
  await prompt.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Pesan untuk asisten')).toHaveValue('Jam buka hari ini kapan?');
  await expect(page.getByLabel('Pesan untuk asisten')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await capture(page, 'chat-actions');
  await page.getByRole('button', { name: 'Lihat menu lengkap' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Tanya restoran', exact: true })).toBeFocused();
  expect(new URL(page.url()).hostname).toBe('127.0.0.1');
});

test('pending request blocks duplicate send and Escape returns focus', async ({ page }) => {
  await session(page);
  let requests = 0;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/chat/messages', async route => {
    requests++;
    await waiting;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ input: 'Menu?', message: 'Data belum tersedia.', cards: [], actions: [] }) });
  });
  await open(page);
  await page.getByLabel('Pesan untuk asisten').fill('Menu?');
  await page.getByLabel('Pesan untuk asisten').press('Enter');
  await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Pesan untuk asisten')).toBeDisabled();
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Tanya restoran', exact: true })).toBeFocused();
});

test('expired session preserves draft and new session recovers', async ({ page }) => {
  await session(page);
  await page.route('**/chat/messages', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
  await open(page);
  await page.getByLabel('Pesan untuk asisten').fill('Menu sintetis?');
  await page.getByLabel('Pesan untuk asisten').press('Enter');
  await expect(page.getByRole('button', { name: 'Mulai sesi baru' })).toBeVisible();
  await expect(page.getByLabel('Pesan untuk asisten')).toHaveValue('Menu sintetis?');
  await capture(page, 'chat-session-expired');
  await page.getByRole('button', { name: 'Mulai sesi baru' }).click();
  await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Pesan untuk asisten')).toHaveValue('');
});

test('AI outage leaves private reservation form usable', async ({ page }) => {
  await session(page);
  let created = false;
  const receipt = { referenceCode: 'synthetic', startAt: '2026-12-01T05:00:00Z', endAt: '2026-12-01T06:30:00Z', timezone: 'Asia/Jakarta', partySize: 2, status: 'confirmed' };
  await page.route('**/reservation/*', route => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (action === 'receipt') return reply(created ? 200 : 403, created ? { data: receipt } : {});
    if (action === 'session' || action === 'management') return reply(200, { data: {} });
    if (action === 'confirmations') return reply(200, { data: { nonce: 'synthetic', summary: { ...route.request().postDataJSON(), ...receipt } } });
    if (action === 'create') { created = true; return reply(200, { data: receipt }); }
    return reply(404, {});
  });
  await page.route('**/chat/messages', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    input: 'Reservasi?', status: 'unavailable', message: 'Asisten belum tersedia.', cards: [],
    actions: [{ id: 'reservation-form', type: 'navigate', label: 'Buka form reservasi', target: '#reservasi' }],
  }) }));
  await open(page);
  await page.getByLabel('Pesan untuk asisten').fill('Reservasi?');
  await page.getByLabel('Pesan untuk asisten').press('Enter');
  await expect(page.getByText('Asisten belum tersedia.', { exact: true })).toBeVisible();
  await capture(page, 'chat-unavailable');
  await page.getByRole('button', { name: 'Buka form reservasi', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('Tanggal (WIB)').fill('2026-12-01');
  await page.getByLabel('Nama', { exact: true }).fill('Tamu Sintetis');
  await page.getByLabel('Nomor telepon').fill('081234567890');
  await page.getByRole('button', { name: 'Periksa meja dan ringkasan' }).click();
  await page.getByRole('button', { name: 'Konfirmasi reservasi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reservasi terkonfirmasi' })).toBeVisible();
});
