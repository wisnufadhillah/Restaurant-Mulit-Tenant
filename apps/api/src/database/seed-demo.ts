import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabaseClient } from "./client";
import { databaseUrl } from "./config";
import { hashPassword } from "../auth/crypto";

async function seedDemo() {
  const target = new URL(databaseUrl());
  if (target.hostname !== "127.0.0.1" || target.port !== "55432" || target.pathname !== "/restaurant" || target.username !== "restaurant") throw new Error("Local target required");
  const directory = resolve(__dirname, "../../../../.local");
  const privateFile = resolve(directory, "demo-staff.json");
  if (existsSync(privateFile)) throw new Error("Private account file already exists");
  const db = createDatabaseClient();
  try {
    const tenants = await db.tenant.findMany({ where: { slug: { in: ["demo-padang", "demo-keluarga"] } }, select: { id: true, slug: true } });
    if (tenants.length !== 2 || await db.staff.count({ where: { tenantId: { in: tenants.map(tenant => tenant.id) } } })) throw new Error("Expected empty demo staff accounts");
    const accounts: { tenantSlug: string; tenantId: string; username: string; role: string; password: string; passwordHash: string }[] = [];
    for (const tenant of tenants) {
      for (const role of ["owner", "staff"]) {
        const password = randomBytes(24).toString("base64url");
        accounts.push({ tenantSlug: tenant.slug, tenantId: tenant.id, username: `demo.${role}`, role, password, passwordHash: await hashPassword(password) });
      }
    }
    mkdirSync(directory, { recursive: true });
    // Persist private access before the transaction so a failed write never creates inaccessible accounts.
    writeFileSync(privateFile, JSON.stringify(accounts.map(({ tenantSlug, username, role, password }) => ({ tenantSlug, username, role, password })), null, 2), { flag: "wx", mode: 0o600 });
    await db.$transaction(async tx => {
      for (const tenant of tenants) {
        const primary = tenant.slug === "demo-padang";
        await tx.tenant.update({ where: { id: tenant.id }, data: { name: primary ? "Dapur Sela — Masakan Padang" : "Dapur Rantau — Demo Isolasi" } });
        await tx.outlet.updateMany({ where: { tenantId: tenant.id }, data: {
          name: primary ? "Dapur Sela Cikini" : "Dapur Rantau Bandung",
          address: primary ? "Jl. Sawo No. 18, Cikini, Jakarta Pusat (alamat demo sintetis)" : "Jl. Rantau No. 24, Bandung (alamat demo sintetis)",
          contactPhone: "", timezone: "Asia/Jakarta", durationMinutes: 90, minNoticeMinutes: 60, maxAdvanceDays: 30, cancelCutoffMinutes: 120, maxPartySize: 12,
        } });
      }
      for (const { tenantId, username, role, passwordHash } of accounts) await tx.staff.create({ data: { tenantId, username, role, passwordHash } });
    });
    console.info("Demo profiles and four staff accounts created. Private credentials saved in .local/demo-staff.json; open privately, never share or commit.");
  } finally { await db.$disconnect(); }
}
void seedDemo().catch(() => { console.error("Demo seed stopped. No existing accounts are overwritten. Check local target and private file existence; if a transaction failed, inspect DB before retry. Details suppressed."); process.exitCode = 1; });
