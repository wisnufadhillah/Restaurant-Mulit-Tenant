import { config } from "dotenv";
import { resolve } from "node:path";

export function databaseUrl(): string {
  config({ path: resolve(__dirname, "../../.env"), quiet: true });
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("DATABASE_URL is invalid"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error("DATABASE_URL must identify a PostgreSQL database");
  }
  return value;
}
