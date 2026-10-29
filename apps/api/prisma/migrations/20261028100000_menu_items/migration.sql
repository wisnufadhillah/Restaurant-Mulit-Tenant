CREATE TABLE "menu_items" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL CHECK (length(trim("name")) BETWEEN 1 AND 120),
  "description" TEXT NOT NULL CHECK (length("description") <= 1000),
  "price" INTEGER NOT NULL CHECK ("price" BETWEEN 0 AND 100000000),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "menu_items_tenant_id_id_key" UNIQUE ("tenant_id", "id")
);
CREATE INDEX "menu_items_tenant_id_idx" ON "menu_items"("tenant_id");
