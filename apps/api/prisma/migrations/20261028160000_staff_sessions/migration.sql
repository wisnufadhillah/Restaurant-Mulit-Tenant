CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_users_role_check" CHECK ("role" IN ('owner', 'staff')),
    CONSTRAINT "staff_users_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_users_tenant_id_id_key" ON "staff_users"("tenant_id", "id");
CREATE UNIQUE INDEX "staff_users_tenant_email_key" ON "staff_users"("tenant_id", "email");

CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_sessions_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "staff_sessions_user_fkey" FOREIGN KEY ("tenant_id", "staff_user_id") REFERENCES "staff_users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "staff_sessions_scope_idx" ON "staff_sessions"("tenant_id", "staff_user_id", "expires_at");
