const { test, expect } = require('@playwright/test');

test('public site and dashboard render against local services', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://127.0.0.1:3000/');
  await expect(page).toHaveTitle(/Raso Minang|Restaurant/i);
  await expect(page.getByText('Raso Minang').first()).toBeVisible();
  await expect(page.locator('#menu')).toBeVisible();

  await page.goto('http://127.0.0.1:3000/dashboard');
  await expect(page.getByText('Katalog & Ketersediaan Menu')).toBeVisible();
  await expect(page.getByRole('button', { name: /Manajemen Meja/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Jam Operasional/ })).toBeVisible();

  expect(errors).toEqual([]);
});

test('dashboard staff login and menu toggle use the API', async ({ page }) => {
  page.on('response', async (response) => {
    if (response.url().includes('/api/v1/staff/')) console.log(`staff-response ${response.url().split('/api/v1/staff/')[1]} ${response.status()}`);
  });
  page.on('requestfailed', (request) => console.log(`request-failed ${request.url()} ${request.failure()?.errorText}`));
  await page.goto('http://127.0.0.1:3000/dashboard');
  await page.getByRole('button', { name: 'Tandai Habis' }).first().click();
  await expect(page.getByLabel('Email staff')).toBeVisible();
  await page.getByLabel('Email staff').fill(process.env.DEMO_STAFF_EMAIL);
  await page.getByLabel('Password staff').fill(process.env.DEMO_STAFF_PASSWORD);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/v1/staff/login') && response.status() === 201),
    page.getByRole('button', { name: 'Masuk' }).click(),
  ]);

  await expect(page.getByText('Katalog & Ketersediaan Menu')).toBeVisible();
  await expect(page.getByLabel('Email staff')).toBeHidden();
  await page.getByRole('button', { name: 'Tandai Habis' }).first().click();
  await expect(page.getByRole('button', { name: 'Tandai Tersedia' }).first()).toBeVisible();
});
