CREATE TABLE "menu_uploads" (
  "key" TEXT NOT NULL,
  "tenant_id" UUID NOT NULL,
  "bytes" INTEGER NOT NULL CHECK ("bytes" > 0 AND "bytes" <= 1048576),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "menu_uploads_pkey" PRIMARY KEY ("tenant_id", "key"),
  CONSTRAINT "menu_uploads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "menu_uploads_key_check" CHECK ("key" ~ '^upload-[a-f0-9]{48}\.webp$')
);

CREATE FUNCTION validate_menu_upload_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.image_key LIKE 'upload-%' AND NOT EXISTS (
    SELECT 1 FROM menu_uploads WHERE tenant_id = NEW.tenant_id AND key = NEW.image_key
  ) THEN
    RAISE EXCEPTION 'Unknown menu image' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER menu_upload_reference BEFORE INSERT OR UPDATE OF image_key, tenant_id ON menu_items
  FOR EACH ROW EXECUTE FUNCTION validate_menu_upload_reference();
