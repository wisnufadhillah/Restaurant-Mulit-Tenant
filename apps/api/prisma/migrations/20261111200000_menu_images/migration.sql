ALTER TABLE "menu_items" ADD COLUMN "image_key" TEXT;

UPDATE "menu_items" AS item
SET "image_key" = photo.image_key
FROM "tenants" AS tenant,
  (VALUES
    ('Rendang sapi', 'padang-rendang.webp'),
    ('Gulai ayam', 'padang-gulai.webp'),
    ('Dendeng balado', 'padang-dendeng.webp'),
    ('Ayam pop', 'ayam-pop.jpg'),
    ('Es jeruk', 'es-jeruk.jpg'),
    ('Es teh tawar', 'es-teh.jpg'),
    ('Gulai kepala ikan', 'gulai-kepala-ikan.jpg'),
    ('Nasi putih', 'nasi.jpg'),
    ('Telur balado', 'telur-balado.jpg')
  ) AS photo(name, image_key)
WHERE item.tenant_id = tenant.id
  AND tenant.slug = 'demo-padang'
  AND item.name = photo.name
  AND item.image_key IS NULL;
