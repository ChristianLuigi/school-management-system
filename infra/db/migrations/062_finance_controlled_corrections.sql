BEGIN;

CREATE TABLE IF NOT EXISTS finance_payment_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  student_id UUID NOT NULL REFERENCES students(id),
  correction_type TEXT NOT NULL CHECK (
    correction_type IN ('REVERSAL', 'REFUND')
  ),
  correction_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (
    correction_status IN (
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'COMPLETED'
    )
  ),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  reason TEXT NOT NULL CHECK (
    char_length(BTRIM(reason)) BETWEEN 10 AND 1000
  ),
  requested_by_user_id UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  processed_by_user_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  refund_method TEXT CHECK (
    refund_method IS NULL
    OR refund_method IN (
      'CASH',
      'BANK_TRANSFER',
      'CHECK',
      'MOBILE_MONEY',
      'CARD',
      'OTHER'
    )
  ),
  refund_reference TEXT,
  cashier_session_id UUID REFERENCES finance_cashier_sessions(id),
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
  ),
  request_hash TEXT NOT NULL CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  original_payment_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payment_correction_lifecycle CHECK (
    (
      correction_status = 'PENDING_REVIEW'
      AND reviewed_by_user_id IS NULL
      AND reviewed_at IS NULL
      AND processed_by_user_id IS NULL
      AND processed_at IS NULL
    )
    OR
    (
      correction_status = 'APPROVED'
      AND reviewed_by_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND processed_by_user_id IS NULL
      AND processed_at IS NULL
    )
    OR
    (
      correction_status = 'REJECTED'
      AND reviewed_by_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND char_length(BTRIM(COALESCE(review_note, ''))) BETWEEN 10 AND 1000
      AND processed_by_user_id IS NULL
      AND processed_at IS NULL
    )
    OR
    (
      correction_status = 'COMPLETED'
      AND reviewed_by_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND processed_by_user_id IS NOT NULL
      AND processed_at IS NOT NULL
    )
  ),
  CONSTRAINT chk_payment_correction_processing CHECK (
    correction_status <> 'COMPLETED'
    OR (
      correction_type = 'REVERSAL'
      AND refund_method IS NULL
      AND refund_reference IS NULL
      AND cashier_session_id IS NULL
    )
    OR (
      correction_type = 'REFUND'
      AND refund_method = 'CASH'
      AND cashier_session_id IS NOT NULL
    )
    OR (
      correction_type = 'REFUND'
      AND refund_method <> 'CASH'
      AND cashier_session_id IS NULL
      AND char_length(BTRIM(COALESCE(refund_reference, ''))) BETWEEN 3 AND 200
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_correction_idempotency
  ON finance_payment_corrections(school_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_correction_active
  ON finance_payment_corrections(payment_id)
  WHERE correction_status IN (
    'PENDING_REVIEW',
    'APPROVED',
    'COMPLETED'
  );

CREATE INDEX IF NOT EXISTS idx_payment_corrections_school_status
  ON finance_payment_corrections(
    school_id,
    correction_status,
    requested_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_payment_corrections_cashier_session
  ON finance_payment_corrections(cashier_session_id)
  WHERE correction_status = 'COMPLETED'
    AND correction_type = 'REFUND';

CREATE TABLE IF NOT EXISTS finance_credit_note_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_finance_credit_note_number(
  p_school_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INT;
  v_next_number INT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  INSERT INTO finance_credit_note_sequences (
    school_id,
    code_year,
    last_number
  )
  VALUES (p_school_id, v_year, 1)
  ON CONFLICT (school_id, code_year)
  DO UPDATE SET
    last_number = finance_credit_note_sequences.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  RETURN
    'CRN-' || v_year::TEXT || '-' ||
    LPAD(v_next_number::TEXT, 5, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS finance_invoice_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  student_id UUID NOT NULL REFERENCES students(id),
  credit_note_number TEXT NOT NULL,
  credit_note_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (
    credit_note_status IN (
      'PENDING_REVIEW',
      'APPLIED',
      'REJECTED'
    )
  ),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  reason TEXT NOT NULL CHECK (
    char_length(BTRIM(reason)) BETWEEN 10 AND 1000
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
  original_invoice_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_credit_note_lifecycle CHECK (
    (
      credit_note_status = 'PENDING_REVIEW'
      AND reviewed_by_user_id IS NULL
      AND reviewed_at IS NULL
    )
    OR
    (
      credit_note_status = 'APPLIED'
      AND reviewed_by_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
    OR
    (
      credit_note_status = 'REJECTED'
      AND reviewed_by_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND char_length(BTRIM(COALESCE(review_note, ''))) BETWEEN 10 AND 1000
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_note_number
  ON finance_invoice_credit_notes(school_id, credit_note_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_note_idempotency
  ON finance_invoice_credit_notes(school_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_note_pending_invoice
  ON finance_invoice_credit_notes(invoice_id)
  WHERE credit_note_status = 'PENDING_REVIEW';

CREATE INDEX IF NOT EXISTS idx_credit_notes_school_status
  ON finance_invoice_credit_notes(
    school_id,
    credit_note_status,
    requested_at DESC
  );

CREATE TABLE IF NOT EXISTS finance_correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  subject_type TEXT NOT NULL CHECK (
    subject_type IN ('PAYMENT_CORRECTION', 'CREDIT_NOTE')
  ),
  subject_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'REQUESTED',
      'APPROVED',
      'REJECTED',
      'COMPLETED'
    )
  ),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_correction_events_subject
  ON finance_correction_events(
    subject_type,
    subject_id,
    created_at
  );

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
