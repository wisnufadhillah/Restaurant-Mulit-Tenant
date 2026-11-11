CREATE TABLE "chat_sessions" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "id")
);
CREATE INDEX "chat_sessions_tenant_id_expires_at_idx" ON "chat_sessions" ("tenant_id", "expires_at");
