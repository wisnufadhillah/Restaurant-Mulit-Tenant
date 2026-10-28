CREATE TABLE "dining_tables" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "name" TEXT NOT NULL CHECK (length(trim("name")) BETWEEN 1 AND 80),
  "capacity" INTEGER NOT NULL CHECK ("capacity" BETWEEN 1 AND 12),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "dining_tables_tenant_id_outlet_id_fkey" FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "dining_tables_tenant_id_outlet_id_id_key" UNIQUE ("tenant_id", "outlet_id", "id"),
  CONSTRAINT "dining_tables_tenant_id_outlet_id_name_key" UNIQUE ("tenant_id", "outlet_id", "name")
);
