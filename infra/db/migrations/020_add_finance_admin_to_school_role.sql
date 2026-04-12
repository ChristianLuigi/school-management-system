DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_role')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'school_role'
         AND e.enumlabel = 'FINANCE_ADMIN'
     ) THEN
    ALTER TYPE school_role ADD VALUE 'FINANCE_ADMIN';
  END IF;
END
$$;