CREATE TABLE "special_hours" (
 "tenant_id" UUID NOT NULL,
 "outlet_id" UUID NOT NULL,
 "date" DATE NOT NULL,
 "open_minute" INTEGER,
 "close_minute" INTEGER,
 PRIMARY KEY ("tenant_id", "outlet_id", "date"),
 FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT,
 CHECK (("open_minute" IS NULL AND "close_minute" IS NULL) OR ("open_minute" IS NOT NULL AND "close_minute" IS NOT NULL AND "open_minute" >= 0 AND "open_minute" < "close_minute" AND "close_minute" <= 1440))
);
CREATE TABLE "operational_audits" (
 "id" UUID PRIMARY KEY,
 "tenant_id" UUID NOT NULL,
 "staff_id" UUID NOT NULL,
 "action" TEXT NOT NULL,
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("tenant_id", "staff_id") REFERENCES "staff"("tenant_id", "id") ON DELETE RESTRICT
);
CREATE INDEX "operational_audits_tenant_id_created_at_idx" ON "operational_audits"("tenant_id", "created_at");
