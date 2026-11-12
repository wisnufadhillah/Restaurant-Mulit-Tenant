import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test.beforeEach(async ({ context, request }) => {
  await request.post('http://127.0.0.1:3311/fixture/reset');
  await context.addCookies([
    { name: 'senja_staff', value: randomBytes(32).toString('base64url'), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
    { name: 'senja_staff_tenant', value: 'demo-padang', url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
  ]);
});

for (const status of ['cancelled', 'completed', 'no_show']) {
  test(`reservation ${status} requires explicit confirmation and appears in audit`, async ({ page }) => {
    await page.goto('/dashboard?tab=reservations');
    await page.getByRole('button', { name: /Lihat detail SYNTHETIC/ }).click();
    await page.getByRole('button', { name: status === 'cancelled' ? 'Batalkan reservasi' : status === 'completed' ? 'Tandai selesai' : 'Tandai tidak hadir', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Konfirmasi status', exact: true });
    if (status === 'cancelled') { await expect(confirm).toBeDisabled(); await page.getByLabel('Alasan pembatalan').fill('Alasan sintetis privat'); }
    if (status === 'no_show') { await expect(confirm).toBeDisabled(); await page.getByRole('checkbox').check(); }
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Batalkan reservasi', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tutup detail', exact: true })).toBeFocused();
    await page.goto('/dashboard?tab=audit');
    await expect(page.getByRole('cell', { name: 'Staff', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '40000000-0000-4000-8000-000000000001', exact: true })).toBeVisible();
    await expect(page.getByText('Alasan sintetis privat', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Kontak sintetis', { exact: true })).toHaveCount(0);
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Lima aktivitas terbaru', exact: true }).getByRole('cell', { name: 'Staff', exact: true })).toBeVisible();
  });
}

test('uncertain transition retains identical key and payload with busy guard', async ({ page }) => {
  const attempts: { key: string; body: string | null }[] = [];
  await page.route('**/staff/reservations?id=*', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    const upstream = await route.fetch();
    if (attempts.length === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    return route.fulfill({ response: upstream });
  });
  await page.goto('/dashboard?tab=reservations');
  await page.getByRole('button', { name: /Lihat detail SYNTHETIC/ }).click();
  await page.getByRole('button', { name: 'Batalkan reservasi', exact: true }).click();
  await page.getByLabel('Alasan pembatalan').fill('Alasan tetap');
  await page.getByRole('button', { name: 'Konfirmasi status', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Hasil belum dapat dipastikan');
  await expect(page.getByLabel('Alasan pembatalan')).toBeDisabled();
  await page.getByRole('button', { name: 'Tutup sementara', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjutkan percobaan status', exact: true }).click();
  await page.getByRole('button', { name: 'Coba lagi dengan percobaan sama', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
});

test('audit authentication failure clears private overview', async ({ page }) => {
  let calls = 0;
  await page.route('**/staff/audit?page=*', route => route.fulfill({ status: ++calls === 1 ? 503 : 401, contentType: 'application/json', body: JSON.stringify({ message: calls === 1 ? 'Riwayat sementara gagal' : 'Sesi berakhir' }) }));
  await page.goto('/dashboard');
  await expect(page.locator('.sela-reservation-summary')).toContainText('Tamu sintetis');
  const audit = page.getByRole('region', { name: 'Lima aktivitas terbaru', exact: true });
  await audit.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Sesi berakhir' })).toBeVisible();
  await expect(page.getByText('Tamu sintetis', { exact: true })).toHaveCount(0);
  await expect(page.locator('.sela-reservation-summary')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Masuk kembali', exact: true })).toBeVisible();
});

test('audit error retry empty state and strict pagination', async ({ page }) => {
  let mode = 'error';
  await page.route('**/staff/audit?page=*', route => {
    if (mode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Riwayat gagal dimuat.' }) });
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: mode === 'empty' ? [] : [{ id: `event-${pageNumber}`, source: 'reservation', createdAt: '2026-01-01T00:00:00Z', action: 'reservation.confirmed', actorType: 'customer', reservationId: 'synthetic', fromStatus: null, toStatus: 'confirmed' }], page: pageNumber, pageSize: 20, total: mode === 'empty' ? 0 : 21 }) });
  });
  await page.goto('/dashboard?tab=audit');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Riwayat gagal dimuat.');
  await expect(page.getByText('Belum ada aktivitas tercatat.')).toHaveCount(0);
  mode = 'empty'; await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByText('Belum ada aktivitas tercatat.')).toBeVisible();
  mode = 'data'; await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Customer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(page.getByText('Halaman 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Berikutnya', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
