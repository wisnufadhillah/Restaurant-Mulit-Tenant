import { test, expect } from '@playwright/test';

test('section navigation keeps clean URL and sticky hamburger supports keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/reservation/*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  const toggle = page.locator('button[aria-controls="senja-navigation"]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Reservasi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Buka navigasi', exact: true })).toHaveAttribute('aria-expanded', 'false');
  expect(new URL(page.url()).hash).toBe('');
  await expect.poll(() => page.evaluate(() => {
    const section = document.getElementById('reservasi')!.getBoundingClientRect();
    const header = document.querySelector('.sela-header-wrap')!.getBoundingClientRect();
    return Math.abs(section.top - header.bottom - 20);
  })).toBeLessThanOrEqual(2);
  await expect(page.locator('#reservasi h2')).toBeFocused();
  expect(await page.locator('.sela-header-wrap').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Dapur Sela.*beranda|Rumah makan.*beranda/ }).click();
  expect(new URL(page.url()).hash).toBe('');
});
