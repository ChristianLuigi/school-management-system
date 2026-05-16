CREATE TABLE IF NOT EXISTS admission_receipt_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_admission_receipt_number(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INT;
  v_next_number INT;
  v_candidate_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  LOOP
    INSERT INTO admission_receipt_sequences (
      school_id,
      code_year,
      last_number
    )
    VALUES (
      p_school_id,
      v_year,
      1
    )
    ON CONFLICT (school_id, code_year)
    DO UPDATE SET
      last_number = admission_receipt_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    v_candidate_number :=
      'ADM-RCPT-' || v_year::TEXT || '-' || LPAD(v_next_number::TEXT, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM admission_applications
      WHERE school_id = p_school_id
        AND deleted_at IS NULL
        AND registration_fee_receipt_number = v_candidate_number
    );
  END LOOP;

  RETURN v_candidate_number;
END;
$$;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_fee_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_fee_currency_code TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_fee_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED';

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_payment_method TEXT;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_payment_reference TEXT;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_fee_paid_at TIMESTAMPTZ;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_fee_receipt_number TEXT;

ALTER TABLE admission_applications
ADD COLUMN IF NOT EXISTS registration_payment_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_admission_registration_fee_status'
  ) THEN
    ALTER TABLE admission_applications
    ADD CONSTRAINT chk_admission_registration_fee_status
    CHECK (
      registration_fee_status IN (
        'NOT_REQUIRED',
        'PENDING',
        'PAID',
        'WAIVED',
        'REFUNDED'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admission_applications_registration_fee_status
  ON admission_applications(school_id, registration_fee_status)
  WHERE deleted_at IS NULL;
