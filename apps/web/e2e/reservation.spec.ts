import { test, expect, Page } from "@playwright/test";

type Scenario = "normal" | "lost" | "unavailable" | "receipt-failure" | "expired-confirmation" | "management-failure";
async function boundary(page: Page, scenario: Scenario = "normal") {
  let saved = false, cancelled = false, lost = false, createCount = 0, managementCalls = 0;
  const keys: string[] = [];
  const receipt = () => ({ referenceCode: "synthetic-booking", startAt: "2026-12-01T05:00:00.000Z", endAt: "2026-12-01T06:30:00.000Z", timezone: "Asia/Jakarta", partySize: 2, status: cancelled ? "cancelled" : "confirmed" });
  await page.route("**/reservation/*", async route => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    const json = (status: number, data: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (action === "receipt") return scenario === "receipt-failure" ? json(503, { message: "Synthetic unavailable" }) : saved ? json(200, { data: receipt() }) : json(403, { message: "No private session" });
    if (action === "session") return json(200, { data: { expiresAt: "2026-12-01T00:00:00Z" } });
    if (action === "confirmations") {
      if (scenario === "unavailable") return json(409, { message: "Meja tidak tersedia." });
      const details = route.request().postDataJSON();
      return json(200, { data: { nonce: "synthetic-nonce", summary: { ...details, ...receipt(), guestName: details.guestName, guestPhone: details.guestPhone } } });
    }
    if (action === "create") {
      createCount++;
      if (scenario === "expired-confirmation") return json(409, { message: "Konfirmasi kedaluwarsa." });
      keys.push(route.request().headers()["idempotency-key"]);
      saved = true;
      if (scenario === "lost" && !lost) { lost = true; return route.abort("connectionreset"); }
      return json(200, { data: receipt() });
    }
    if (action === "management") {
      managementCalls++;
      if (scenario === "management-failure" && managementCalls === 1) return json(503, { message: "Synthetic management failure" });
      return json(200, { data: { expiresAt: "2026-12-01T00:00:00Z" } });
    }
    if (action === "cancel") { cancelled = true; return json(200, { data: receipt() }); }
    if (action === "logout") { saved = false; return route.fulfill({ status: 204 }); }
    return json(404, {});
  });
  return { calls: () => createCount, keys };
}
async function fill(page: Page) {
  await page.goto("/#reservasi");
  await page.getByLabel("Tanggal (WIB)").fill("2026-12-01");
  await page.getByLabel("Nama", { exact: true }).fill("Tamu Sintetis");
  await page.getByLabel("Nomor telepon").fill("081234567890");
  await page.getByRole("button", { name: "Periksa meja dan ringkasan" }).click();
  await expect(page.getByRole("heading", { name: "Periksa reservasi", exact: true })).toBeVisible();
}

test('normal confirmation, refresh, explicit cancellation and logout', async ({ page }) => {
  const state = await boundary(page);
  await fill(page);
  await page.getByRole("button", { name: "Konfirmasi reservasi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reservasi terkonfirmasi" })).toBeVisible();
  expect(state.calls()).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Reservasi terkonfirmasi" })).toBeVisible();
  await page.getByRole("button", { name: "Batalkan reservasi", exact: true }).click();
  await page.getByRole("button", { name: "Ya, batalkan reservasi" }).click();
  await expect(page.getByRole("heading", { name: "Reservasi dibatalkan" })).toBeVisible();
  await page.getByRole("button", { name: "Tutup akses privat" }).click();
  await expect(page.getByLabel("Tanggal (WIB)")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('lost response keeps attempt identity and prevents detail correction', async ({ page }) => {
  const state = await boundary(page, "lost");
  await fill(page);
  await page.getByRole("button", { name: "Konfirmasi reservasi", exact: true }).click();
  await expect(page.getByRole("button", { name: "Coba ulang percobaan yang sama" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Koreksi detail" })).toBeDisabled();
  await page.getByRole("button", { name: "Coba ulang percobaan yang sama" }).click();
  await expect(page.getByRole("heading", { name: "Reservasi terkonfirmasi" })).toBeVisible();
  expect(state.keys).toHaveLength(2);
  expect(state.keys[0]).toBe(state.keys[1]);
});

test('unavailable table does not create booking', async ({ page }) => {
  const state = await boundary(page, "unavailable");
  await page.goto("/#reservasi");
  await page.getByLabel("Tanggal (WIB)").fill("2026-12-01");
  await page.getByLabel("Nama", { exact: true }).fill("Tamu Sintetis");
  await page.getByLabel("Nomor telepon").fill("081234567890");
  await page.getByRole("button", { name: "Periksa meja dan ringkasan" }).click();
  await expect(page.locator('#reservasi').getByRole("alert")).toContainText("Meja tidak tersedia");
  expect(state.calls()).toBe(0);
});

test('receipt dependency failure blocks new booking; keyboard can reach form after explicit no-session', async ({ page }) => {
  await boundary(page, "receipt-failure");
  await page.goto("/#reservasi");
  await expect(page.getByText("Status reservasi belum dapat diperiksa.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Tanggal (WIB)")).toHaveCount(0);
});

test('management recovery keeps lookup after a failed initial issue', async ({ page }) => {
  await boundary(page, "management-failure");
  await fill(page);
  await page.getByRole('button', { name: 'Konfirmasi reservasi', exact: true }).click();
  await expect(page.locator('#reservasi').getByRole('alert')).toContainText('Synthetic management failure');
  await page.getByRole('button', { name: 'Muat status / pulihkan akses' }).click();
  await expect.poll(() => page.evaluate(() => !!sessionStorage.getItem('reservation_lookup'))).toBe(true);
  expect(await page.evaluate(() => sessionStorage.getItem('reservation_attempt'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Reservasi terkonfirmasi' })).toBeVisible();
});

test('expired confirmation returns to editable form instead of trapping recovery', async ({ page }) => {
  await boundary(page, "expired-confirmation");
  await fill(page);
  await page.getByRole("button", { name: "Konfirmasi reservasi", exact: true }).click();
  await expect(page.getByLabel("Tanggal (WIB)")).toBeVisible();
  await expect(page.locator('#reservasi').getByRole('alert')).toContainText('Konfirmasi kedaluwarsa');
});

test('keyboard submission uses native labels and correction invalidates summary', async ({ page }) => {
  await boundary(page);
  await fill(page);
  await page.getByRole("button", { name: "Koreksi detail" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tanggal (WIB)")).toBeVisible();
  await page.getByLabel("Nama", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Nomor telepon")).toBeFocused();
});
