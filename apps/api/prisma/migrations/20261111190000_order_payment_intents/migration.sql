ALTER TABLE "orders"
  ADD COLUMN "request_hash" TEXT,
  ADD COLUMN "snap_creation_state" TEXT NOT NULL DEFAULT 'unknown'
    CHECK ("snap_creation_state" IN ('creating', 'ready', 'unknown'));

CREATE TABLE "order_payment_events" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "from_status" TEXT NOT NULL,
  "to_status" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE RESTRICT
);
CREATE INDEX "order_payment_events_tenant_id_order_id_created_at_idx"
  ON "order_payment_events" ("tenant_id", "order_id", "created_at");
