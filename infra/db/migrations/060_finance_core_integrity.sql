BEGIN;

CREATE TABLE IF NOT EXISTS finance_idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  operation_type TEXT NOT NULL CHECK (
    operation_type IN (
      'INVOICE_CREATE',
      'STUDENT_INVOICE_CREATE',
      'PAYMENT_RECORD',
      'STUDENT_PAYMENT_RECORD'
    )
  ),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  response_body JSONB NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_finance_idempotency_key_length CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
  ),
  CONSTRAINT uq_finance_idempotency_operation UNIQUE (
    school_id,
    operation_type,
    idempotency_key
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_idempotency_created_at
  ON finance_idempotency_records(created_at);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency_code TEXT;

UPDATE payments pay
SET currency_code = COALESCE(
  inv.currency_code,
  settings.default_currency_code,
  'USD'
)
FROM invoices inv
LEFT JOIN school_finance_settings settings
  ON settings.school_id = inv.school_id
 AND settings.deleted_at IS NULL
WHERE pay.invoice_id = inv.id
  AND pay.currency_code IS NULL;

UPDATE payments pay
SET currency_code = COALESCE(
  settings.default_currency_code,
  'USD'
)
FROM school_finance_settings settings
WHERE settings.school_id = pay.school_id
  AND settings.deleted_at IS NULL
  AND pay.currency_code IS NULL;

UPDATE payments
SET currency_code = 'USD'
WHERE currency_code IS NULL;

ALTER TABLE payments
  ALTER COLUMN currency_code SET DEFAULT 'USD',
  ALTER COLUMN currency_code SET NOT NULL;

/*
 * Rebuild invoice balances from the canonical confirmed-payment ledger.
 * Refuse to hide historical overpayments: an operator must reconcile those
 * records before this migration can safely complete.
 */
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM invoices inv
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(pay.amount), 0) AS confirmed_amount
      FROM payments pay
      WHERE pay.invoice_id = inv.id
        AND pay.school_id = inv.school_id
        AND pay.payment_status = 'CONFIRMED'
        AND pay.deleted_at IS NULL
    ) totals ON TRUE
    WHERE inv.deleted_at IS NULL
      AND totals.confirmed_amount > inv.total_amount
  ) THEN
    RAISE EXCEPTION
      'Finance integrity migration found an invoice with confirmed payments above its total.';
  END IF;
END $$;

WITH confirmed_payments AS (
  SELECT
    inv.id AS invoice_id,
    COALESCE(SUM(pay.amount), 0)::numeric(12, 2) AS amount_paid
  FROM invoices inv
  LEFT JOIN payments pay
    ON pay.invoice_id = inv.id
   AND pay.school_id = inv.school_id
   AND pay.payment_status = 'CONFIRMED'
   AND pay.deleted_at IS NULL
  WHERE inv.deleted_at IS NULL
  GROUP BY inv.id
)
UPDATE invoices inv
SET
  amount_paid = totals.amount_paid,
  balance_due = inv.total_amount - totals.amount_paid,
  invoice_status = CASE
    WHEN inv.invoice_status = 'VOID'
      AND totals.amount_paid = 0
      THEN 'VOID'::invoice_status
    WHEN totals.amount_paid >= inv.total_amount
      AND inv.total_amount > 0
      THEN 'PAID'::invoice_status
    WHEN totals.amount_paid > 0
      THEN 'PARTIALLY_PAID'::invoice_status
    WHEN inv.invoice_status = 'DRAFT'
      THEN 'DRAFT'::invoice_status
    WHEN inv.due_date IS NOT NULL
      AND inv.due_date < CURRENT_DATE
      THEN 'OVERDUE'::invoice_status
    ELSE 'ISSUED'::invoice_status
  END,
  updated_at = NOW()
FROM confirmed_payments totals
WHERE totals.invoice_id = inv.id;

UPDATE invoices
SET status = invoice_status
WHERE status IS DISTINCT FROM invoice_status;

UPDATE payments
SET status = payment_status
WHERE status IS DISTINCT FROM payment_status;

CREATE OR REPLACE FUNCTION synchronize_finance_compatibility_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    NEW.status := NEW.invoice_status;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    NEW.status := NEW.payment_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_finance_status ON invoices;
CREATE TRIGGER trg_sync_invoice_finance_status
BEFORE INSERT OR UPDATE OF invoice_status
ON invoices
FOR EACH ROW
EXECUTE FUNCTION synchronize_finance_compatibility_columns();

DROP TRIGGER IF EXISTS trg_sync_payment_finance_status ON payments;
CREATE TRIGGER trg_sync_payment_finance_status
BEFORE INSERT OR UPDATE OF payment_status
ON payments
FOR EACH ROW
EXECUTE FUNCTION synchronize_finance_compatibility_columns();

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_finance_amounts,
  DROP CONSTRAINT IF EXISTS chk_invoices_finance_balance,
  DROP CONSTRAINT IF EXISTS chk_invoices_currency_code;

ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_finance_amounts CHECK (
    subtotal_amount >= 0
    AND discount_amount >= 0
    AND discount_amount <= subtotal_amount
    AND total_amount = subtotal_amount - discount_amount
    AND amount_paid >= 0
    AND amount_paid <= total_amount
    AND balance_due >= 0
  ),
  ADD CONSTRAINT chk_invoices_finance_balance CHECK (
    balance_due = total_amount - amount_paid
  ),
  ADD CONSTRAINT chk_invoices_currency_code CHECK (
    currency_code ~ '^[A-Z]{3}$'
  );

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS chk_payments_finance_amount,
  DROP CONSTRAINT IF EXISTS chk_payments_currency_code,
  DROP CONSTRAINT IF EXISTS chk_payments_reference_by_method;

ALTER TABLE payments
  ADD CONSTRAINT chk_payments_finance_amount CHECK (
    amount > 0
  ),
  ADD CONSTRAINT chk_payments_currency_code CHECK (
    currency_code ~ '^[A-Z]{3}$'
  ),
  ADD CONSTRAINT chk_payments_reference_by_method CHECK (
    COALESCE(payment_method::text, method, '') = 'CASH'
    OR NULLIF(
      BTRIM(
        COALESCE(
          payment_reference,
          reference,
          reference_no,
          ''
        )
      ),
      ''
    ) IS NOT NULL
  ) NOT VALID;

/*
 * Expand the permission allow-list without editing migration 058.
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
      'FINANCE_REPORTS_VIEW',
      'FINANCE_REPORTS_EXPORT',
      'FINANCE_SETTINGS_MANAGE',
      'PAYROLL_VIEW',
      'PAYROLL_MANAGE'
    )
  );

COMMIT;
