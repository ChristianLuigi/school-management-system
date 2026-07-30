BEGIN;

/*
 * F4 rebuilds recurring school billing on top of the canonical invoice ledger.
 * Legacy fee_plans rows remain readable, but only plans with an academic year
 * and plan code can be used by the controlled billing workflow.
 */
ALTER TABLE fee_plans
  ADD COLUMN IF NOT EXISTS plan_code TEXT,
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id),
  ADD COLUMN IF NOT EXISTS description_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_due_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE fee_plans
  DROP CONSTRAINT IF EXISTS chk_fee_plans_plan_code,
  DROP CONSTRAINT IF EXISTS chk_fee_plans_default_due_days,
  DROP CONSTRAINT IF EXISTS chk_fee_plans_currency_code;

ALTER TABLE fee_plans
  ADD CONSTRAINT chk_fee_plans_plan_code CHECK (
    plan_code IS NULL
    OR plan_code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
  ),
  ADD CONSTRAINT chk_fee_plans_default_due_days CHECK (
    default_due_days BETWEEN 0 AND 365
  ),
  ADD CONSTRAINT chk_fee_plans_currency_code CHECK (
    currency_code ~ '^[A-Z]{3}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_plans_year_code_active
  ON fee_plans(school_id, academic_year_id, plan_code)
  WHERE deleted_at IS NULL
    AND academic_year_id IS NOT NULL
    AND plan_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fee_plans_controlled_lookup
  ON fee_plans(
    school_id,
    academic_year_id,
    grade_level_id,
    is_active
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_billing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  fee_plan_id UUID NOT NULL REFERENCES fee_plans(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  grade_level_id UUID REFERENCES grade_levels(id),
  billing_period_code TEXT NOT NULL CHECK (
    billing_period_code ~ '^[A-Z0-9][A-Z0-9_-]{0,49}$'
  ),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  invoice_status TEXT NOT NULL CHECK (
    invoice_status IN ('DRAFT', 'ISSUED')
  ),
  currency_code TEXT NOT NULL CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  unit_amount NUMERIC(12, 2) NOT NULL CHECK (
    unit_amount > 0
  ),
  run_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (
    run_status = 'COMPLETED'
  ),
  candidate_count INT NOT NULL DEFAULT 0 CHECK (
    candidate_count >= 0
  ),
  generated_count INT NOT NULL DEFAULT 0 CHECK (
    generated_count >= 0
  ),
  skipped_count INT NOT NULL DEFAULT 0 CHECK (
    skipped_count >= 0
  ),
  plan_snapshot JSONB NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
  ),
  request_hash TEXT NOT NULL CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  response_body JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_billing_run_dates CHECK (
    due_date >= issue_date
  ),
  CONSTRAINT chk_billing_run_counts CHECK (
    candidate_count = generated_count + skipped_count
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_billing_run_idempotency
  ON finance_billing_runs(school_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_finance_billing_runs_school_created
  ON finance_billing_runs(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_billing_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  billing_run_id UUID NOT NULL REFERENCES finance_billing_runs(id),
  fee_plan_id UUID NOT NULL REFERENCES fee_plans(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  student_id UUID NOT NULL REFERENCES students(id),
  billing_period_code TEXT NOT NULL CHECK (
    billing_period_code ~ '^[A-Z0-9][A-Z0-9_-]{0,49}$'
  ),
  item_status TEXT NOT NULL CHECK (
    item_status IN ('GENERATED', 'SKIPPED_DUPLICATE')
  ),
  invoice_id UUID REFERENCES invoices(id),
  existing_invoice_id UUID REFERENCES invoices(id),
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_billing_run_item_result CHECK (
    (
      item_status = 'GENERATED'
      AND invoice_id IS NOT NULL
      AND existing_invoice_id IS NULL
      AND skip_reason IS NULL
    )
    OR
    (
      item_status = 'SKIPPED_DUPLICATE'
      AND invoice_id IS NULL
      AND existing_invoice_id IS NOT NULL
      AND char_length(BTRIM(COALESCE(skip_reason, ''))) > 0
    )
  ),
  CONSTRAINT uq_billing_run_student UNIQUE (
    billing_run_id,
    student_id
  )
);

/*
 * This is the database-level duplicate-charge guard. Multiple catch-up runs
 * are allowed for a period, but a student can receive the charge only once.
 */
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_student_period_charge
  ON finance_billing_run_items(
    school_id,
    student_id,
    fee_plan_id,
    academic_year_id,
    billing_period_code
  )
  WHERE item_status = 'GENERATED';

CREATE INDEX IF NOT EXISTS idx_billing_run_items_run
  ON finance_billing_run_items(
    billing_run_id,
    item_status,
    student_id
  );

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS fee_plan_id UUID REFERENCES fee_plans(id),
  ADD COLUMN IF NOT EXISTS billing_run_id UUID
    REFERENCES finance_billing_runs(id);

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS fee_plan_id UUID REFERENCES fee_plans(id),
  ADD COLUMN IF NOT EXISTS billing_run_id UUID
    REFERENCES finance_billing_runs(id);

CREATE INDEX IF NOT EXISTS idx_invoices_billing_run
  ON invoices(billing_run_id)
  WHERE billing_run_id IS NOT NULL
    AND deleted_at IS NULL;

/*
 * Batch billing is intentionally separate from ordinary invoice creation.
 */
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'school_user_permissions'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%permission_code%'
  LOOP
    EXECUTE format(
      'ALTER TABLE school_user_permissions DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE school_user_permissions
  ADD CONSTRAINT chk_school_user_permissions_code CHECK (
    permission_code IN (
      'FINANCE_DASHBOARD_VIEW',
      'FINANCE_INVOICES_VIEW',
      'FINANCE_INVOICES_CREATE',
      'FINANCE_INVOICES_EDIT',
      'FINANCE_INVOICES_VOID',
      'FINANCE_BILLING_MANAGE',
      'FINANCE_PAYMENTS_VIEW',
      'FINANCE_PAYMENTS_RECORD',
      'FINANCE_PAYMENTS_REVERSE',
      'FINANCE_RECEIPTS_PRINT',
      'FINANCE_CASHIER_SESSIONS_SUPERVISE',
      'FINANCE_CREDIT_NOTES_CREATE',
      'FINANCE_CORRECTIONS_APPROVE',
      'FINANCE_REPORTS_VIEW',
      'FINANCE_REPORTS_EXPORT',
      'FINANCE_SETTINGS_MANAGE',
      'PAYROLL_VIEW',
      'PAYROLL_MANAGE'
    )
  );

COMMIT;
