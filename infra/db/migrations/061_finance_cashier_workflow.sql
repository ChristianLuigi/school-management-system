BEGIN;

CREATE TABLE IF NOT EXISTS finance_cashier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  cashier_user_id UUID NOT NULL REFERENCES users(id),
  business_date DATE NOT NULL,
  currency_code TEXT NOT NULL,
  session_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
    session_status IN ('OPEN', 'CLOSED')
  ),
  opening_cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (
    opening_cash_amount >= 0
  ),
  expected_cash_amount NUMERIC(12, 2),
  closing_cash_amount NUMERIC(12, 2),
  variance_amount NUMERIC(12, 2),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by_user_id UUID REFERENCES users(id),
  reopened_count INT NOT NULL DEFAULT 0 CHECK (
    reopened_count >= 0
  ),
  last_reopened_at TIMESTAMPTZ,
  last_reopened_by_user_id UUID REFERENCES users(id),
  last_reopen_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_cashier_session_currency CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT chk_cashier_session_close_values CHECK (
    (
      session_status = 'OPEN'
      AND expected_cash_amount IS NULL
      AND closing_cash_amount IS NULL
      AND variance_amount IS NULL
      AND closed_at IS NULL
      AND closed_by_user_id IS NULL
    )
    OR
    (
      session_status = 'CLOSED'
      AND expected_cash_amount IS NOT NULL
      AND closing_cash_amount IS NOT NULL
      AND variance_amount IS NOT NULL
      AND closed_at IS NOT NULL
      AND closed_by_user_id IS NOT NULL
      AND expected_cash_amount >= 0
      AND closing_cash_amount >= 0
      AND variance_amount =
        closing_cash_amount - expected_cash_amount
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_session_day_currency
  ON finance_cashier_sessions(
    school_id,
    cashier_user_id,
    business_date,
    currency_code
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cashier_sessions_school_day
  ON finance_cashier_sessions(
    school_id,
    business_date,
    session_status
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_cashier_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  cashier_session_id UUID NOT NULL
    REFERENCES finance_cashier_sessions(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('OPENED', 'CLOSED', 'REOPENED')
  ),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashier_session_events_session
  ON finance_cashier_session_events(
    cashier_session_id,
    created_at
  );

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cashier_session_id UUID
    REFERENCES finance_cashier_sessions(id);

CREATE INDEX IF NOT EXISTS idx_payments_cashier_session
  ON payments(cashier_session_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_receipt_print_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  cashier_session_id UUID REFERENCES finance_cashier_sessions(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  print_kind TEXT NOT NULL CHECK (
    print_kind IN ('INITIAL', 'REPRINT')
  ),
  print_format TEXT NOT NULL CHECK (
    print_format IN ('A4', 'THERMAL_80MM')
  ),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_receipt_reprint_reason CHECK (
    print_kind = 'INITIAL'
    OR char_length(BTRIM(COALESCE(reason, ''))) BETWEEN 5 AND 500
  )
);

CREATE INDEX IF NOT EXISTS idx_receipt_print_events_payment
  ON finance_receipt_print_events(
    payment_id,
    created_at
  );

/*
 * Validate the session boundary in PostgreSQL as well as in the API. Historical
 * payments remain valid because cashier_session_id is nullable, but every new
 * cashier-linked payment must match the open session, actor, business date and
 * currency.
 */
CREATE OR REPLACE FUNCTION validate_payment_cashier_session()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_row finance_cashier_sessions%ROWTYPE;
  payment_actor_user_id UUID;
BEGIN
  IF NEW.cashier_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO session_row
  FROM finance_cashier_sessions
  WHERE id = NEW.cashier_session_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashier session is not available.';
  END IF;

  payment_actor_user_id :=
    COALESCE(NEW.received_by_user_id, NEW.recorded_by_user_id);

  IF session_row.school_id <> NEW.school_id
     OR session_row.cashier_user_id <> payment_actor_user_id
     OR session_row.currency_code <> NEW.currency_code
     OR session_row.session_status <> 'OPEN'
     OR session_row.business_date <> NEW.payment_date::date THEN
    RAISE EXCEPTION
      'Payment does not match its open cashier session.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_cashier_session ON payments;
CREATE TRIGGER trg_validate_payment_cashier_session
BEFORE INSERT OR UPDATE OF
  cashier_session_id,
  school_id,
  payment_date,
  currency_code,
  received_by_user_id,
  recorded_by_user_id
ON payments
FOR EACH ROW
EXECUTE FUNCTION validate_payment_cashier_session();

/*
 * Add the explicit supervisor permission without editing migration 060.
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
      'FINANCE_PAYMENTS_VIEW',
      'FINANCE_PAYMENTS_RECORD',
      'FINANCE_PAYMENTS_REVERSE',
      'FINANCE_RECEIPTS_PRINT',
      'FINANCE_CASHIER_SESSIONS_SUPERVISE',
      'FINANCE_REPORTS_VIEW',
      'FINANCE_REPORTS_EXPORT',
      'FINANCE_SETTINGS_MANAGE',
      'PAYROLL_VIEW',
      'PAYROLL_MANAGE'
    )
  );

COMMIT;
