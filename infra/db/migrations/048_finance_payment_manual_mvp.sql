DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method'
      AND e.enumlabel = 'CHECK'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'CHECK';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method'
      AND e.enumlabel = 'OTHER'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'OTHER';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_payment_number(p_school_id UUID)
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
    INSERT INTO payment_sequences (
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
      last_number = payment_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    v_candidate_number :=
      'PAY-' || v_year::TEXT || '-' || LPAD(v_next_number::TEXT, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM payments
      WHERE school_id = p_school_id
        AND payment_number = v_candidate_number
    );
  END LOOP;

  RETURN v_candidate_number;
END;
$$;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_number TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'CONFIRMED';

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_method payment_method;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_school_student
  ON payments(school_id, student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON payments(invoice_id)
  WHERE deleted_at IS NULL;