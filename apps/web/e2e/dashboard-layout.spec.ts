import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test.beforeEach(async ({ context, request }) => {
  await request.post('http://127.0.0.1:3311/fixture/reset');
  await context.addCookies([
    { name: 'senja_staff', value: randomBytes(32).toString('base64url'), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
    { name: 'senja_staff_tenant', value: 'demo-padang', url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Strict' },
  ]);
});

for (const role of ['owner', 'staff']) {
  for (const width of [320, 390, 1280]) {
    test(`${role} dashboard pages fit ${width}px with accessible navigation`, async ({ page, request }) => {
      if (role === 'staff') await request.post('http://127.0.0.1:3311/fixture/staff');
      await page.setViewportSize({ width, height: 850 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [tab, title] of [['overview', 'Ikhtisar operasional restoran'], ['outlets', 'Lokasi restoran'], ['profile', 'Profil restoran'], ['hours', 'Jam operasional'], ['tables', 'Konfigurasi meja'], ['reservations', 'Manajemen reservasi meja'], ['menu', 'Katalog menu masakan'], ['audit', 'Audit dan jejak aktivitas']]) {
        await page.goto(`/dashboard?tab=${tab}`);
        await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
        await expect(page.getByText(/Memuat (data restoran|profil restoran|jadwal|hari khusus|meja|reservasi|menu)…/)).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const toggle = page.getByRole('button', { name: 'Buka navigasi', exact: true });
        const nav = page.getByRole('navigation', { name: 'Navigasi pengelola' });
        if (width < 1025) {
          await expect(nav).toBeHidden();
          await toggle.focus();
          await page.keyboard.press('Enter');
          await expect(page.getByRole('button', { name: 'Tutup navigasi', exact: true })).toHaveAttribute('aria-expanded', 'true');
          await expect(nav).toBeVisible();
          await expect(nav.locator('a[aria-current="page"]')).toBeFocused();
          await page.keyboard.press('Escape');
          await expect(toggle).toBeFocused();
          await expect(nav).toBeHidden();
        } else {
          await expect(toggle).toBeHidden();
          await expect(nav).toBeVisible();
        }
        if (tab === 'profile') await expect(page.getByLabel('Nama restoran', { exact: true })).toHaveJSProperty('readOnly', role === 'staff');
        if (tab === 'hours') await expect(page.getByRole('button', { name: 'Simpan Senin', exact: true })).toHaveCount(role === 'owner' ? 1 : 0);
        if (tab === 'tables') await expect(page.getByRole('button', { name: 'Simpan meja', exact: true })).toHaveCount(role === 'owner' ? 1 : 0);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('mobile navigation links navigate and desktop resize keeps one sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await page.getByRole('navigation', { name: 'Navigasi pengelola' }).getByRole('link', { name: /Lokasi restoran/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lokasi restoran' })).toBeVisible();
  await expect(page.locator('#staff-content')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Buka navigasi' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await page.getByRole('navigation', { name: 'Navigasi pengelola' }).getByRole('link', { name: /Lokasi restoran/ }).click();
  await expect(page.getByRole('button', { name: 'Buka navigasi' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#staff-content')).toBeFocused();
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(page.getByRole('navigation', { name: 'Navigasi pengelola' })).toHaveCount(1);
  await expect(page.locator('.sela-admin-navigation-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 768, height: 850 });
  await expect(page.getByRole('navigation', { name: 'Navigasi pengelola' })).toBeHidden();
});

test('profile separates loading, error, recovery and preserves known fields', async ({ page }) => {
  let fail = true;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/staff/profile', async route => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    await gate;
    await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { message: 'Synthetic unavailable' } : { data: { name: 'Profil sintetis', outletName: 'Lokasi sintetis', address: 'Alamat sintetis', contactPhone: '' } }) });
  });
  await page.goto('/dashboard?tab=profile');
  await expect(page.getByRole('status')).toHaveText('Memuat profil restoran…');
  await expect(page.getByText('Profil belum tersedia', { exact: true })).toHaveCount(0);
  release!();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Profil gagal dimuat.');
  fail = false;
  await page.getByRole('button', { name: 'Coba lagi memuat profil' }).click();
  await expect(page.getByLabel('Nama restoran', { exact: true })).toHaveValue('Profil sintetis');
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Nama restoran', { exact: true }).fill('Draft profil sintetis');
  fail = true;
  await page.getByRole('button', { name: 'Simpan profil', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Data terakhir tetap ditampilkan.');
  await expect(page.getByLabel('Nama restoran', { exact: true })).toHaveValue('Draft profil sintetis');
  fail = false;
  await page.getByRole('button', { name: 'Coba lagi memuat profil' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Nama restoran', { exact: true })).toHaveValue('Draft profil sintetis');
});

test('special hours separates loading, errors, empty and retains known data on failed refresh', async ({ page }) => {
  let response: unknown = [{ date: '2027-01-01', openMinute: null, closeMinute: null }];
  let status = 503;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/staff/special-hours', async route => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    await gate;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data: response }) });
  });
  await page.goto('/dashboard?tab=hours');
  await expect(page.getByText('Memuat hari khusus…', { exact: true })).toBeVisible();
  await expect(page.getByText(/Belum ada hari khusus/)).toHaveCount(0);
  release!();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Hari khusus gagal dimuat.');
  status = 200;
  await page.getByRole('button', { name: 'Coba lagi memuat hari khusus' }).click();
  await expect(page.getByRole('button', { name: 'Hapus pengecualian 2027-01-01' })).toBeVisible();
  status = 503;
  await page.getByLabel('Tanggal khusus', { exact: true }).fill('2027-01-02');
  await page.getByRole('button', { name: 'Simpan hari khusus' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Data terakhir tetap ditampilkan.');
  await expect(page.getByRole('button', { name: 'Hapus pengecualian 2027-01-01' })).toBeVisible();
  response = [];
  status = 200;
  await page.reload();
  await expect(page.getByText(/Belum ada hari khusus. Jadwal mingguan tetap berlaku/)).toBeVisible();
});

for (const resource of ['menu', 'tables', 'hours']) {
  test(`${resource} load failure is not empty and retry clears error`, async ({ page }) => {
    let fail = true;
    await page.route(`**/staff/${resource}`, route => fail ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
    await page.goto(`/dashboard?tab=${resource}`);
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    if (resource === 'hours') await expect(page.locator('.sela-hours-row')).toHaveCount(0);
    else await expect(page.getByText(resource === 'menu' ? /Belum ada menu\./ : /Belum ada meja\./)).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    if (resource === 'tables') {
      await page.getByRole('button', { name: 'Edit Meja sintetis' }).click();
      await expect(page.getByLabel('Nama meja', { exact: true })).toBeFocused();
    }
  });
}

test('reservation detail and filters remain read only, tables expose scroll cue and form controls meet size floor', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/dashboard?tab=reservations');
  await page.getByRole('button', { name: 'Terapkan filter' }).click();
  await page.getByRole('button', { name: /Lihat detail SYNTHETIC/ }).click();
  await expect(page.getByRole('heading', { name: 'Reservasi Tamu sintetis' })).toBeFocused();
  await page.getByRole('button', { name: 'Tutup detail' }).click();
  await expect(page.getByRole('button', { name: /Lihat detail SYNTHETIC/ })).toBeFocused();
  await expect(page.getByRole('region', { name: /Daftar reservasi, dapat digeser/ })).toBeVisible();
  await page.goto('/dashboard?tab=hours');
  await expect(page.getByRole('button', { name: 'Simpan Senin' })).toBeVisible();
  for (const input of await page.locator('input:not([type="checkbox"])').all()) {
    const size = await input.evaluate(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }));
    expect(size.font).toBeGreaterThanOrEqual(16);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
});
