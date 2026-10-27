import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/database/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl() },
});
