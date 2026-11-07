import { test, expect } from "@playwright/test";

test('chat renders FAQ source as inert text with revision and no invented links', async ({ page }) => {
  await page.route('**/chat/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/chat/messages', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ input: 'Panduan website?', message: 'Berikut sumber yang sesuai.', cards: [{ type: 'knowledge', data: [{ documentId: '11111111-1111-4111-8111-111111111111', revision: 2, position: 0, title: 'Panduan sintetis', text: '<script>window.unsafeFaq = true</script> Gunakan form web.' }] }] }) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Tanya restoran' }).click();
  await page.getByLabel('Pesan untuk asisten').fill('Panduan website?');
  await page.getByRole('button', { name: 'Kirim', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Sumber jawaban', exact: true })).toBeVisible();
  await expect(page.getByText('Panduan sintetis', { exact: true })).toBeVisible();
  await expect(page.getByText('Versi sumber 2', { exact: true })).toBeVisible();
  await expect(page.getByText('<script>window.unsafeFaq = true</script> Gunakan form web.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => 'unsafeFaq' in window)).toBe(false);
});
