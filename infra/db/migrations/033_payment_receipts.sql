ALTER TABLE payments
ADD COLUMN IF NOT EXISTS receipt_number TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS receipt_generated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_school_receipt_number_active
  ON payments(school_id, receipt_number)
  WHERE receipt_number IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_receipt_number
  ON payments(receipt_number)
  WHERE deleted_at IS NULL;
