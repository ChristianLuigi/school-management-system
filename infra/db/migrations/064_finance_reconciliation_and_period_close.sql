BEGIN;

CREATE TABLE IF NOT EXISTS finance_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  account_code TEXT NOT NULL CHECK (
    account_code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
  ),
  display_name TEXT NOT NULL CHECK (
    char_length(BTRIM(display_name)) BETWEEN 2 AND 120
  ),
  currency_code TEXT NOT NULL CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  institution_name TEXT,
  account_reference_masked TEXT CHECK (
    account_reference_masked IS NULL
    OR char_length(BTRIM(account_reference_masked)) BETWEEN 3 AND 80
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_finance_bank_account_archive CHECK (
    (is_active AND archived_at IS NULL)
    OR (NOT is_active AND archived_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_bank_account_code
  ON finance_bank_accounts(school_id, account_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_bank_accounts_school
  ON finance_bank_accounts(school_id, is_active, display_name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  bank_account_id UUID NOT NULL REFERENCES finance_bank_accounts(id),
  currency_code TEXT NOT NULL CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  deposit_date DATE NOT NULL,
  expected_amount NUMERIC(12, 2) NOT NULL CHECK (
    expected_amount > 0
  ),
  deposited_amount NUMERIC(12, 2) NOT NULL CHECK (
    deposited_amount > 0
  ),
  variance_amount NUMERIC(12, 2) NOT NULL,
  deposit_reference TEXT NOT NULL CHECK (
    char_length(BTRIM(deposit_reference)) BETWEEN 3 AND 200
  ),
  evidence_note TEXT CHECK (
    evidence_note IS NULL
    OR char_length(BTRIM(evidence_note)) BETWEEN 3 AND 1000
  ),
  reconciliation_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (
    reconciliation_status IN (
      'PENDING_REVIEW',
      'RECONCILED',
      'REJECTED'
    )
  ),
  requested_by_user_id UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
  ),
  request_hash TEXT NOT NULL CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  response_body JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_finance_deposit_variance CHECK (
    variance_amount = deposited_amount - expected_amount
  ),
  CONSTRAINT chk_finance_deposit_lifecycle CHECK (
    (
      reconciliation_status = 'PENDING_REVIEW'
      AND reviewed_by_user_id IS NULL
      AND reviewed_at IS NULL
      AND review_note IS NULL
    )
    OR
    (
      reconciliation_status IN ('RECONCILED', 'REJECTED')
      AND reviewed_by_user_id IS NOT NULL
      AND reviewed_by_user_id <> requested_by_user_id
      AND reviewed_at IS NOT NULL
      AND char_length(BTRIM(COALESCE(review_note, ''))) BETWEEN 10 AND 1000
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_deposit_idempotency
  ON finance_deposits(school_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_finance_deposits_school_status
  ON finance_deposits(
    school_id,
    reconciliation_status,
    deposit_date DESC
  );

CREATE TABLE IF NOT EXISTS finance_deposit_cashier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  deposit_id UUID NOT NULL REFERENCES finance_deposits(id),
  cashier_session_id UUID NOT NULL REFERENCES finance_cashier_sessions(id),
  expected_collection_amount NUMERIC(12, 2) NOT NULL CHECK (
    expected_collection_amount > 0
  ),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_deposit_session_pair UNIQUE (
    deposit_id,
    cashier_session_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_active_deposit_session
  ON finance_deposit_cashier_sessions(cashier_session_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_deposit_sessions_deposit
  ON finance_deposit_cashier_sessions(deposit_id, released_at);

CREATE TABLE IF NOT EXISTS finance_reconciliation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  subject_type TEXT NOT NULL CHECK (
    subject_type IN ('BANK_ACCOUNT', 'DEPOSIT', 'ACCOUNTING_PERIOD')
  ),
  subject_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'CREATED',
      'ARCHIVED',
      'REACTIVATED',
      'SUBMITTED',
      'RECONCILED',
      'REJECTED',
      'CLOSED',
      'REOPENED'
    )
  ),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_events_subject
  ON finance_reconciliation_events(
    subject_type,
    subject_id,
    created_at
  );

CREATE TABLE IF NOT EXISTS finance_accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  period_code TEXT NOT NULL CHECK (
    period_code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
  ),
  display_name TEXT NOT NULL CHECK (
    char_length(BTRIM(display_name)) BETWEEN 2 AND 120
  ),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
    period_status IN ('OPEN', 'CLOSED')
  ),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  closed_by_user_id UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  reopened_by_user_id UUID REFERENCES users(id),
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  reopen_count INT NOT NULL DEFAULT 0 CHECK (reopen_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_finance_period_dates CHECK (
    end_date >= start_date
  ),
  CONSTRAINT chk_finance_period_lifecycle CHECK (
    (
      period_status = 'OPEN'
      AND closed_by_user_id IS NULL
      AND closed_at IS NULL
      AND close_reason IS NULL
    )
    OR
    (
      period_status = 'CLOSED'
      AND closed_by_user_id IS NOT NULL
      AND closed_at IS NOT NULL
      AND char_length(BTRIM(COALESCE(close_reason, '')))
        BETWEEN 10 AND 1000
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_period_code
  ON finance_accounting_periods(school_id, period_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_periods_school_dates
  ON finance_accounting_periods(
    school_id,
    start_date,
    end_date,
    period_status
  )
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION validate_finance_accounting_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM finance_accounting_periods period
    WHERE period.school_id = NEW.school_id
      AND period.id <> NEW.id
      AND period.deleted_at IS NULL
      AND daterange(period.start_date, period.end_date, '[]')
        && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION
      'Financial accounting periods cannot overlap for a school.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_finance_period_overlap
  ON finance_accounting_periods;
CREATE TRIGGER trg_validate_finance_period_overlap
BEFORE INSERT OR UPDATE OF school_id, start_date, end_date, deleted_at
ON finance_accounting_periods
FOR EACH ROW
WHEN (NEW.deleted_at IS NULL)
EXECUTE FUNCTION validate_finance_accounting_period_overlap();

CREATE OR REPLACE FUNCTION enforce_open_finance_period()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  operation_date DATE;
  closed_period RECORD;
BEGIN
  operation_date :=
    (to_jsonb(NEW) ->> TG_ARGV[0])::DATE;

  SELECT period_code, display_name
  INTO closed_period
  FROM finance_accounting_periods
  WHERE school_id = NEW.school_id
    AND period_status = 'CLOSED'
    AND deleted_at IS NULL
    AND operation_date BETWEEN start_date AND end_date
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Financial period % is closed for %.',
      closed_period.period_code,
      TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_open_finance_period ON invoices;
CREATE TRIGGER trg_invoice_open_finance_period
BEFORE INSERT OR UPDATE OF school_id, issue_date
ON invoices
FOR EACH ROW
EXECUTE FUNCTION enforce_open_finance_period('issue_date');

DROP TRIGGER IF EXISTS trg_payment_open_finance_period ON payments;
CREATE TRIGGER trg_payment_open_finance_period
BEFORE INSERT OR UPDATE OF school_id, payment_date
ON payments
FOR EACH ROW
EXECUTE FUNCTION enforce_open_finance_period('payment_date');

DROP TRIGGER IF EXISTS trg_cashier_session_open_finance_period
  ON finance_cashier_sessions;
CREATE TRIGGER trg_cashier_session_open_finance_period
BEFORE INSERT OR UPDATE OF school_id, business_date
ON finance_cashier_sessions
FOR EACH ROW
EXECUTE FUNCTION enforce_open_finance_period('business_date');

DROP TRIGGER IF EXISTS trg_billing_run_open_finance_period
  ON finance_billing_runs;
CREATE TRIGGER trg_billing_run_open_finance_period
BEFORE INSERT OR UPDATE OF school_id, issue_date
ON finance_billing_runs
FOR EACH ROW
EXECUTE FUNCTION enforce_open_finance_period('issue_date');

DROP TRIGGER IF EXISTS trg_deposit_open_finance_period ON finance_deposits;
CREATE TRIGGER trg_deposit_open_finance_period
BEFORE INSERT OR UPDATE OF school_id, deposit_date
ON finance_deposits
FOR EACH ROW
EXECUTE FUNCTION enforce_open_finance_period('deposit_date');

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
      'FINANCE_RECONCILIATION_MANAGE',
      'FINANCE_PERIOD_CLOSE',
      'FINANCE_REPORTS_VIEW',
      'FINANCE_REPORTS_EXPORT',
      'FINANCE_SETTINGS_MANAGE',
      'PAYROLL_VIEW',
      'PAYROLL_MANAGE'
    )
  );

COMMIT;
