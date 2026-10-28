import { createDatabaseClient } from "./client";
import { databaseUrl } from "./config";

async function seedMenu() {
  const target = new URL(databaseUrl());
  if (target.hostname !== "127.0.0.1" || target.port !== "55432" || target.pathname !== "/restaurant") throw new Error("Local target required");
  const db = createDatabaseClient();
  try {
    await db.$transaction(async tx => {
      for (const slug of ["demo-padang", "demo-keluarga"]) {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { slug } });
        const names = slug === "demo-padang" ? ["Rendang sapi", "Gulai ayam", "Dendeng balado"] : ["Ayam panggang rantau", "Sayur santan rantau"];
        for (const [index, name] of names.entries()) {
          const id = `30000000-0000-4000-${slug === "demo-padang" ? "8000" : "8001"}-00000000000${index + 1}`;
          await tx.menuItem.upsert({ where: { id }, update: {}, create: { id, tenantId: tenant.id, name, description: "Menu sintetis untuk demo rumah makan. Harga dapat diubah pemilik.", price: [35000, 32000, 38000][index], isActive: true, isAvailable: true } });
        }
      }
    });
    console.info("Synthetic menus available for two tenants; existing menu values preserved.");
  } finally { await db.$disconnect(); }
}
void seedMenu().catch(() => { console.error("Menu seed failed; details suppressed"); process.exitCode = 1; });
