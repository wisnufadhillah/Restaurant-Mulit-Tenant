CREATE TABLE "staff" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'staff')),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "staff_username_check" CHECK ("username" ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  CONSTRAINT "staff_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "staff_tenant_id_username_key" UNIQUE ("tenant_id", "username")
);

CREATE TABLE "staff_sessions" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE CHECK ("token_hash" ~ '^[a-f0-9]{64}$'),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "staff_sessions_tenant_id_staff_id_fkey" FOREIGN KEY ("tenant_id", "staff_id")
    REFERENCES "staff"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "staff_sessions_expiry_check" CHECK ("expires_at" > "created_at")
);
CREATE INDEX "staff_sessions_tenant_id_staff_id_idx" ON "staff_sessions"("tenant_id", "staff_id");
CREATE INDEX "staff_sessions_expires_at_idx" ON "staff_sessions"("expires_at");
