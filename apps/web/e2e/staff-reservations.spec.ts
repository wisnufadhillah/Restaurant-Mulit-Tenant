import { test, expect } from '@playwright/test';

test('unauthenticated staff reservation route is private and dashboard redirects to login', async ({ page }) => {
  // The real dashboard requires a server-side staff session; exercise component through
  // the authenticated user page when integration fixtures are available, not by bypassing auth.
  const response = await page.request.get('/staff/reservations');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toBe('no-store');
  await page.goto('/dashboard?tab=reservations');
  await expect(page).toHaveURL(/\/login/);
});
