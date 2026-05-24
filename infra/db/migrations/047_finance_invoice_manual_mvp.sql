CREATE TABLE IF NOT EXISTS invoice_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_invoice_number(p_school_id UUID)
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
    INSERT INTO invoice_sequences (
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
      last_number = invoice_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    v_candidate_number :=
      'INV-' || v_year::TEXT || '-' || LPAD(v_next_number::TEXT, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM invoices
      WHERE school_id = p_school_id
        AND invoice_number = v_candidate_number
    );
  END LOOP;

  RETURN v_candidate_number;
END;
$$;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_title TEXT;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS notes TEXT;