import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { databaseUrl } from "./config";

export function createDatabaseClient() {
  const adapter = new PrismaPg({ connectionString: databaseUrl(), connectionTimeoutMillis: 5000, max: 5 });
  return new PrismaClient({ adapter });
}
