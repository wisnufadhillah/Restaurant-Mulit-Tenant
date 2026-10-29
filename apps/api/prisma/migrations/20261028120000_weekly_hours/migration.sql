CREATE TABLE "weekly_hours" (
 "tenant_id" UUID NOT NULL,
 "outlet_id" UUID NOT NULL,
 "weekday" INTEGER NOT NULL CHECK ("weekday" BETWEEN 0 AND 6),
 "open_minute" INTEGER,
 "close_minute" INTEGER,
 PRIMARY KEY ("tenant_id", "outlet_id", "weekday"),
 CONSTRAINT "weekly_hours_tenant_id_outlet_id_fkey" FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT,
 CONSTRAINT "weekly_hours_interval_check" CHECK (
   ("open_minute" IS NULL AND "close_minute" IS NULL) OR
   ("open_minute" IS NOT NULL AND "close_minute" IS NOT NULL AND "open_minute" >= 0 AND "open_minute" < "close_minute" AND "close_minute" <= 1440)
 )
);
