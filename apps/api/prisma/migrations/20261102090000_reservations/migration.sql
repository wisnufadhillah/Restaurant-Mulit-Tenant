BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "reservations" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "table_id" UUID NOT NULL,
  "reference_code" TEXT NOT NULL CHECK (length(trim("reference_code")) BETWEEN 1 AND 80),
  "management_token_hash" TEXT NOT NULL CHECK ("management_token_hash" ~ '^[a-f0-9]{64}$'),
  "management_expires_at" TIMESTAMPTZ(3) NOT NULL,
  "guest_name" TEXT NOT NULL CHECK (length(trim("guest_name")) BETWEEN 1 AND 120),
  "guest_phone" TEXT NOT NULL CHECK (length(trim("guest_phone")) BETWEEN 1 AND 40),
  "start_at" TIMESTAMPTZ(3) NOT NULL,
  "end_at" TIMESTAMPTZ(3) NOT NULL,
  "party_size" INTEGER NOT NULL CHECK ("party_size" BETWEEN 1 AND 12),
  "status" TEXT NOT NULL DEFAULT 'confirmed' CHECK ("status" IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  "source" TEXT NOT NULL CHECK ("source" IN ('web', 'chat')),
  "idempotency_key" TEXT NOT NULL CHECK (length(trim("idempotency_key")) BETWEEN 1 AND 128),
  "request_hash" TEXT NOT NULL CHECK ("request_hash" ~ '^[a-f0-9]{64}$'),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservations_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "reservations_tenant_id_reference_code_key" UNIQUE ("tenant_id", "reference_code"),
  CONSTRAINT "reservations_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "reservations_outlet_fkey" FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "reservations_table_fkey" FOREIGN KEY ("tenant_id", "outlet_id", "table_id") REFERENCES "dining_tables"("tenant_id", "outlet_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "reservations_interval_check" CHECK (isfinite("start_at") AND isfinite("end_at") AND "end_at" = "start_at" + INTERVAL '90 minutes'),
  CONSTRAINT "reservations_management_expiry_check" CHECK (isfinite("management_expires_at") AND "management_expires_at" > "end_at" AND "management_expires_at" <= "end_at" + INTERVAL '24 hours'),
  CONSTRAINT "reservations_confirmed_no_overlap" EXCLUDE USING GIST (
    "tenant_id" WITH =,
    "table_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE ("status" = 'confirmed')
);
CREATE INDEX "reservations_tenant_id_outlet_id_start_at_idx" ON "reservations"("tenant_id", "outlet_id", "start_at");

CREATE TABLE "reservation_events" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL CHECK ("actor_type" IN ('customer', 'staff', 'system')),
  "staff_id" UUID,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_events_reservation_fkey" FOREIGN KEY ("tenant_id", "reservation_id") REFERENCES "reservations"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "reservation_events_staff_fkey" FOREIGN KEY ("tenant_id", "staff_id") REFERENCES "staff"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "reservation_events_transition_check" CHECK (
    ("from_status" IS NULL AND "to_status" = 'confirmed') OR
    ("from_status" IS NOT NULL AND "from_status" = 'confirmed' AND "to_status" IN ('cancelled', 'completed', 'no_show'))
  ),
  CONSTRAINT "reservation_events_actor_check" CHECK (
    ("actor_type" = 'staff' AND "staff_id" IS NOT NULL) OR
    ("actor_type" IN ('customer', 'system') AND "staff_id" IS NULL)
  ),
  CONSTRAINT "reservation_events_reason_check" CHECK ("reason" IS NULL OR length(trim("reason")) BETWEEN 1 AND 500),
  CONSTRAINT "reservation_events_staff_cancellation_reason_check" CHECK (
    NOT ("actor_type" = 'staff' AND "to_status" = 'cancelled') OR "reason" IS NOT NULL
  )
);
CREATE INDEX "reservation_events_tenant_id_reservation_id_created_at_idx" ON "reservation_events"("tenant_id", "reservation_id", "created_at");

COMMIT;
