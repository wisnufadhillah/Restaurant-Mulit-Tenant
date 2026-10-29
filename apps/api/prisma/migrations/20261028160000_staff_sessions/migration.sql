-- Keep staff identity and session storage on the canonical tenant-scoped schema.
DO $$
BEGIN
  IF to_regclass('public.staff') IS NULL OR to_regclass('public.staff_sessions') IS NULL THEN
    RAISE EXCEPTION 'Canonical staff migrations must be applied first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_sessions' AND column_name = 'staff_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_sessions' AND column_name = 'created_at') THEN
    RAISE EXCEPTION 'Unexpected staff session schema; manual migration review required';
  END IF;
END $$;
