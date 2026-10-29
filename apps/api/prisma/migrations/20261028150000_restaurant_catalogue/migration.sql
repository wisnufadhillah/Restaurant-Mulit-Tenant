CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_items_price_check" CHECK ("price" >= 0),
    CONSTRAINT "menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_items_outlet_fkey" FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "menu_items_tenant_id_id_key" ON "menu_items"("tenant_id", "id");
CREATE INDEX "menu_items_tenant_outlet_available_idx" ON "menu_items"("tenant_id", "outlet_id", "is_available");

CREATE TABLE "dining_tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "table_number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "area" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_tables_capacity_check" CHECK ("capacity" > 0),
    CONSTRAINT "dining_tables_status_check" CHECK ("status" IN ('available', 'reserved', 'maintenance')),
    CONSTRAINT "dining_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "dining_tables_outlet_fkey" FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "dining_tables_tenant_id_id_key" ON "dining_tables"("tenant_id", "id");
CREATE UNIQUE INDEX "dining_tables_outlet_id_table_number_key" ON "dining_tables"("outlet_id", "table_number");
CREATE INDEX "dining_tables_tenant_outlet_status_idx" ON "dining_tables"("tenant_id", "outlet_id", "status");

CREATE TABLE "opening_hours" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_minutes" INTEGER NOT NULL,
    "close_minutes" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "opening_hours_range_check" CHECK ("day_of_week" BETWEEN 0 AND 6 AND "open_minutes" BETWEEN 0 AND 1439 AND "close_minutes" BETWEEN 1 AND 1440 AND "close_minutes" > "open_minutes"),
    CONSTRAINT "opening_hours_outlet_fkey" FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "opening_hours_tenant_outlet_day_key" ON "opening_hours"("tenant_id", "outlet_id", "day_of_week");
