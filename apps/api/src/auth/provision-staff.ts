import { databaseUrl } from "../database/config";
import { createDatabaseClient } from "../database/client";
import { hashPassword } from "./crypto";

async function provision() {
  const url = new URL(databaseUrl());
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/restaurant" || url.username !== "restaurant") throw new Error("Local target required");
  const slug = process.env.STAFF_TENANT_SLUG;
  const username = process.env.STAFF_USERNAME;
  const role = process.env.STAFF_ROLE;
  const password = process.env.STAFF_PASSWORD;
  delete process.env.STAFF_PASSWORD;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80 || !username || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || !role || !["owner", "staff"].includes(role) || !password) throw new Error("Private configuration required");
  const passwordHash = await hashPassword(password);
  const db = createDatabaseClient();
  try {
    const tenant = await db.tenant.findFirst({ where: { slug, status: "active" }, select: { id: true } });
    if (!tenant) throw new Error("Active tenant required");
    await db.staff.create({ data: { tenantId: tenant.id, username, role, passwordHash } });
    console.info("Staff account created locally. Existing accounts are never overwritten.");
  } finally { await db.$disconnect(); }
}

void provision().catch(() => { console.error("Staff provisioning failed; check private input, active tenant and account uniqueness. Details suppressed."); process.exitCode = 1; });
