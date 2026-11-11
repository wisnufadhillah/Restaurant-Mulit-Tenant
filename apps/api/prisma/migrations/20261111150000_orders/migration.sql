CREATE TABLE "orders" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "code" TEXT NOT NULL UNIQUE,
  "customer_name" TEXT NOT NULL,
  "customer_phone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'confirmed', 'cancelled')),
  "payment_status" TEXT NOT NULL DEFAULT 'unpaid' CHECK ("payment_status" IN ('unpaid', 'pending', 'settlement', 'expire', 'cancel', 'deny')),
  "payment_method" TEXT,
  "order_total" INTEGER NOT NULL CHECK ("order_total" > 0),
  "items" JSONB NOT NULL,
  "midtrans_order_id" TEXT UNIQUE,
  "snap_token" TEXT,
  "redirect_url" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "id"),
  UNIQUE ("tenant_id", "idempotency_key")
);
CREATE INDEX "orders_tenant_id_created_at_idx" ON "orders" ("tenant_id", "created_at");
