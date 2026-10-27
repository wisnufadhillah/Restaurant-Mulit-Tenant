import { createDatabaseClient } from "./client";

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
      }
    });
    console.log("Synthetic tenants and outlets are available");
  } finally { await client.$disconnect(); }
}
void seed().catch(() => { console.error("Database seed failed; details suppressed to protect connection data"); process.exitCode = 1; });
