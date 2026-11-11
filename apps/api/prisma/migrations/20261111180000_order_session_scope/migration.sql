ALTER TABLE "orders" ADD COLUMN "chat_session_id" UUID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_chat_session_id_fkey" FOREIGN KEY ("tenant_id", "chat_session_id") REFERENCES "chat_sessions"("tenant_id", "id") ON DELETE RESTRICT;
CREATE INDEX "orders_tenant_id_chat_session_id_idx" ON "orders" ("tenant_id", "chat_session_id");
