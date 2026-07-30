BEGIN;

ALTER TYPE payroll_run_status
  ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';

ALTER TYPE payroll_run_status
  ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS run_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS content_checksum TEXT,
  ADD COLUMN IF NOT EXISTS submitted_for_review_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_approval_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_run_version_positive'
  ) THEN
    ALTER TABLE payroll_runs
      ADD CONSTRAINT ck_payroll_run_version_positive
      CHECK (run_version > 0)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_run_content_checksum'
  ) THEN
    ALTER TABLE payroll_runs
      ADD CONSTRAINT ck_payroll_run_content_checksum
      CHECK (
        content_checksum IS NULL
        OR content_checksum ~ '^[0-9a-f]{64}$'
      )
      NOT VALID;
  END IF;
END $$;

ALTER TABLE payroll_runs
  VALIDATE CONSTRAINT ck_payroll_run_version_positive;

ALTER TABLE payroll_runs
  VALIDATE CONSTRAINT ck_payroll_run_content_checksum;

CREATE TABLE IF NOT EXISTS payroll_run_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
  run_version INTEGER NOT NULL CHECK (run_version > 0),
  content_checksum TEXT NOT NULL CHECK (
    content_checksum ~ '^[0-9a-f]{64}$'
  ),
  total_gross NUMERIC(12, 2) NOT NULL CHECK (total_gross >= 0),
  total_allowances NUMERIC(12, 2) NOT NULL CHECK (total_allowances >= 0),
  total_deductions NUMERIC(12, 2) NOT NULL CHECK (total_deductions >= 0),
  total_net NUMERIC(12, 2) NOT NULL CHECK (total_net >= 0),
  staff_count INTEGER NOT NULL CHECK (staff_count >= 0),
  decision TEXT NOT NULL CHECK (
    decision IN (
      'APPROVED',
      'RETURNED'
    )
  ),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL CHECK (
    actor_role = 'SCHOOL_ADMIN'
  ),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payroll_run_approval_scope'
  ) THEN
    ALTER TABLE payroll_run_approvals
      ADD CONSTRAINT fk_payroll_run_approval_scope
      FOREIGN KEY (payroll_run_id, school_id)
      REFERENCES payroll_runs(id, school_id)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE payroll_run_approvals
  VALIDATE CONSTRAINT fk_payroll_run_approval_scope;

CREATE INDEX IF NOT EXISTS idx_payroll_run_approvals_run
  ON payroll_run_approvals(
    payroll_run_id,
    created_at ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_run_approved_version
  ON payroll_run_approvals(
    payroll_run_id,
    run_version
  )
  WHERE decision = 'APPROVED';

CREATE OR REPLACE FUNCTION payroll_run_approvals_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Payroll approval records are append-only.';
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_run_approvals_append_only
  ON payroll_run_approvals;

CREATE TRIGGER trg_payroll_run_approvals_append_only
BEFORE UPDATE OR DELETE
ON payroll_run_approvals
FOR EACH ROW
EXECUTE FUNCTION payroll_run_approvals_append_only();

CREATE OR REPLACE FUNCTION payroll_guard_run_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_from TEXT;
  v_to TEXT;
BEGIN
  IF OLD.payroll_status::TEXT = 'CLOSED' THEN
    RAISE EXCEPTION 'Closed payroll runs are locked.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_from := OLD.payroll_status::TEXT;
  v_to := NEW.payroll_status::TEXT;

  IF v_from <> v_to
     AND NOT (
       (v_from = 'DRAFT' AND v_to IN ('UNDER_REVIEW', 'CANCELLED'))
       OR (
         v_from = 'UNDER_REVIEW'
         AND v_to IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
       )
       OR (
         v_from = 'REVIEWED'
         AND v_to IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
       )
       OR (
         v_from = 'PENDING_APPROVAL'
         AND v_to IN ('DRAFT', 'APPROVED', 'CANCELLED')
       )
       OR (v_from = 'APPROVED' AND v_to IN ('DRAFT', 'PROCESSING'))
       OR (v_from = 'PROCESSING' AND v_to = 'PAID')
       OR (v_from = 'PAID' AND v_to IN ('PROCESSING', 'CLOSED'))
     ) THEN
    RAISE EXCEPTION
      'Invalid payroll status transition from % to %.',
      v_from,
      v_to;
  END IF;

  IF v_from <> 'DRAFT'
     AND (
       NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.period_label IS DISTINCT FROM OLD.period_label
       OR NEW.period_start IS DISTINCT FROM OLD.period_start
       OR NEW.period_end IS DISTINCT FROM OLD.period_end
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.total_gross IS DISTINCT FROM OLD.total_gross
       OR NEW.total_allowances IS DISTINCT FROM OLD.total_allowances
       OR NEW.total_deductions IS DISTINCT FROM OLD.total_deductions
       OR NEW.total_net IS DISTINCT FROM OLD.total_net
       OR (
         NEW.content_checksum IS DISTINCT FROM OLD.content_checksum
         AND NOT (
           v_from = 'REVIEWED'
           AND v_to = 'PENDING_APPROVAL'
           AND OLD.content_checksum IS NULL
           AND NEW.content_checksum ~ '^[0-9a-f]{64}$'
         )
       )
     ) THEN
    RAISE EXCEPTION
      'Reviewed or processed payroll financial data is immutable.';
  END IF;

  IF NEW.run_version < OLD.run_version THEN
    RAISE EXCEPTION
      'Payroll run versions cannot move backwards.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_guard_run_update
  ON payroll_runs;

CREATE TRIGGER trg_payroll_guard_run_update
BEFORE UPDATE OR DELETE
ON payroll_runs
FOR EACH ROW
EXECUTE FUNCTION payroll_guard_run_update();

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel
      ON rel.oid = con.conrelid
    JOIN pg_namespace nsp
      ON nsp.oid = rel.relnamespace
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
      'FINANCE_RECONCILIATION_MANAGE',
      'FINANCE_PERIOD_CLOSE',
      'FINANCE_REPORTS_VIEW',
      'FINANCE_REPORTS_EXPORT',
      'FINANCE_SETTINGS_MANAGE',
      'PAYROLL_VIEW',
      'PAYROLL_MANAGE',
      'PAYROLL_PREPARE',
      'PAYROLL_REVIEW',
      'PAYROLL_PROCESS',
      'PAYROLL_REVERSE'
    )
  );

COMMIT;
