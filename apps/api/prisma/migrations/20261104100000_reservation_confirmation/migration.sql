BEGIN;

CREATE TABLE "reservation_creator_sessions" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "token_hash" TEXT NOT NULL UNIQUE CHECK ("token_hash" ~ '^[a-f0-9]{64}$'),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  UNIQUE ("tenant_id", "id"),
  CHECK (isfinite("expires_at") AND "expires_at" > "created_at"),
  CHECK ("revoked_at" IS NULL OR (isfinite("revoked_at") AND "revoked_at" >= "created_at"))
);
CREATE INDEX "reservation_creator_sessions_expires_at_idx" ON "reservation_creator_sessions"("expires_at");

ALTER TABLE "reservations" ADD COLUMN "creator_session_id" UUID;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_creator_session_fkey"
  FOREIGN KEY ("tenant_id", "creator_session_id") REFERENCES "reservation_creator_sessions"("tenant_id", "id") ON DELETE RESTRICT;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenant_id_creator_session_id_id_key"
  UNIQUE ("tenant_id", "creator_session_id", "id");

CREATE TABLE "reservation_confirmations" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "creator_session_id" UUID NOT NULL,
  "nonce_hash" TEXT NOT NULL UNIQUE CHECK ("nonce_hash" ~ '^[a-f0-9]{64}$'),
  "request_hash" TEXT NOT NULL CHECK ("request_hash" ~ '^[a-f0-9]{64}$'),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "invalidated_at" TIMESTAMPTZ(3),
  "reservation_id" UUID,
  FOREIGN KEY ("tenant_id", "creator_session_id") REFERENCES "reservation_creator_sessions"("tenant_id", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("tenant_id", "creator_session_id", "reservation_id") REFERENCES "reservations"("tenant_id", "creator_session_id", "id") ON DELETE RESTRICT,
  UNIQUE ("tenant_id", "creator_session_id", "reservation_id"),
  CHECK (isfinite("expires_at") AND "expires_at" > "created_at"),
  CHECK (("consumed_at" IS NULL AND "reservation_id" IS NULL) OR
    ("consumed_at" IS NOT NULL AND "reservation_id" IS NOT NULL AND isfinite("consumed_at") AND
     "consumed_at" >= "created_at" AND "consumed_at" < "expires_at" AND "invalidated_at" IS NULL)),
  CHECK ("invalidated_at" IS NULL OR (isfinite("invalidated_at") AND "invalidated_at" >= "created_at"))
);
CREATE INDEX "reservation_confirmations_tenant_id_creator_session_id_expires_idx"
  ON "reservation_confirmations"("tenant_id", "creator_session_id", "expires_at");

COMMIT;
