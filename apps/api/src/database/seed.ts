import { createDatabaseClient } from "./client";
import { hashPassword } from "../auth/crypto";

async function seed() {
  const client = createDatabaseClient();
  try {
    await client.$transaction(async (tx) => {
      const examples = [
        { id: "10000000-0000-4000-8000-000000000001", outletId: "20000000-0000-4000-8000-000000000001", slug: "demo-padang", name: "Restoran Padang Demo" },
        { id: "10000000-0000-4000-8000-000000000002", outletId: "20000000-0000-4000-8000-000000000002", slug: "demo-keluarga", name: "Restoran Keluarga Demo" },
      ];
      for (const item of examples) {
        await tx.tenant.upsert({ where: { id: item.id }, update: {}, create: { id: item.id, slug: item.slug, name: item.name } });
        await tx.outlet.upsert({ where: { id: item.outletId }, update: {}, create: { id: item.outletId, tenantId: item.id, name: "Outlet Demo", address: "Alamat sintetis untuk pengujian", contactPhone: "" } });
        const demoPassword = process.env.DEMO_STAFF_PASSWORD;
        if (demoPassword) {
          const email = (process.env.DEMO_STAFF_EMAIL ?? "staff@demo.local").toLowerCase();
          await tx.staffUser.upsert({ where: { tenantId_email: { tenantId: item.id, email } }, update: { passwordHash: await hashPassword(demoPassword), isActive: true }, create: { tenantId: item.id, email, passwordHash: await hashPassword(demoPassword), role: "owner" } });
        }
        const menu = item.slug === "demo-padang" ? [
          ["30000000-0000-4000-8000-000000000001", "Rendang Demo", "utama", 32000, "Rendang sintetis untuk pengujian."],
          ["30000000-0000-4000-8000-000000000002", "Ayam Pop Demo", "utama", 26000, "Ayam pop sintetis untuk pengujian."],
          ["30000000-0000-4000-8000-000000000003", "Teh Talua Demo", "minuman", 22000, "Minuman sintetis untuk pengujian."],
        ] as const : [
          ["30000000-0000-4000-8000-000000000101", "Rendang Keluarga Demo", "utama", 31000, "Rendang sintetis tenant kedua."],
          ["30000000-0000-4000-8000-000000000102", "Ayam Keluarga Demo", "utama", 25000, "Ayam sintetis tenant kedua."],
          ["30000000-0000-4000-8000-000000000103", "Teh Keluarga Demo", "minuman", 21000, "Minuman sintetis tenant kedua."],
        ] as const;
        for (const [sortOrder, [id, name, category, price, description]] of menu.entries()) {
          await tx.menuItem.upsert({ where: { id }, update: { tenantId: item.id, outletId: item.outletId, name, category, price, description, isAvailable: true, sortOrder }, create: { id, tenantId: item.id, outletId: item.outletId, name, category, price, description, sortOrder } });
        }
        const tables = item.slug === "demo-padang" ? [["40000000-0000-4000-8000-000000000001", "Meja 01", 2, "Indoor AC"], ["40000000-0000-4000-8000-000000000002", "Meja 02", 4, "Indoor AC"]] as const : [["40000000-0000-4000-8000-000000000101", "Meja 01", 2, "Indoor AC"], ["40000000-0000-4000-8000-000000000102", "Meja 02", 4, "Indoor AC"]] as const;
        for (const [id, tableNumber, capacity, area] of tables) {
          await tx.diningTable.upsert({ where: { id }, update: { tenantId: item.id, outletId: item.outletId, tableNumber, capacity, area, status: "available" }, create: { id, tenantId: item.id, outletId: item.outletId, tableNumber, capacity, area, status: "available" } });
        }
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
          await tx.openingHour.upsert({ where: { tenantId_outletId_dayOfWeek: { tenantId: item.id, outletId: item.outletId, dayOfWeek } }, update: {}, create: { tenantId: item.id, outletId: item.outletId, dayOfWeek, openMinutes: 600, closeMinutes: 1290, isOpen: true } });
        }
      }
    });
    console.log("Synthetic tenants and outlets are available");
  } finally { await client.$disconnect(); }
}
void seed().catch(() => { console.error("Database seed failed; details suppressed to protect connection data"); process.exitCode = 1; });
