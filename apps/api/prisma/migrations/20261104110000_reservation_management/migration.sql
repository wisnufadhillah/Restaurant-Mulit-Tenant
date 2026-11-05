BEGIN;
CREATE TABLE "reservation_management_sessions" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE CHECK ("token_hash" ~ '^[a-f0-9]{64}$'),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  FOREIGN KEY ("tenant_id", "reservation_id") REFERENCES "reservations"("tenant_id", "id") ON DELETE RESTRICT,
  CHECK (isfinite("expires_at") AND "expires_at" > "created_at"),
  CHECK ("revoked_at" IS NULL OR (isfinite("revoked_at") AND "revoked_at" >= "created_at"))
);
CREATE INDEX "reservation_management_sessions_tenant_id_reservation_id_idx"
  ON "reservation_management_sessions"("tenant_id", "reservation_id");
COMMIT;
