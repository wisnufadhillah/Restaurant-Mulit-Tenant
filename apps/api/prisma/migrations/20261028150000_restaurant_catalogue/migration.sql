-- Verify the canonical catalogue created by earlier migrations; do not create parallel tables.
DO $$
BEGIN
  IF to_regclass('public.menu_items') IS NULL
     OR to_regclass('public.dining_tables') IS NULL
     OR to_regclass('public.weekly_hours') IS NULL THEN
    RAISE EXCEPTION 'Canonical restaurant catalogue migrations must be applied first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'is_active')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dining_tables' AND column_name = 'name') THEN
    RAISE EXCEPTION 'Unexpected catalogue schema; manual migration review required';
  END IF;
END $$;
