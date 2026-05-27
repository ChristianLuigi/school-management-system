DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status') THEN
    CREATE TYPE payroll_run_status AS ENUM (
      'DRAFT',
      'APPROVED',
      'PAID',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_payment_status') THEN
    CREATE TYPE payroll_payment_status AS ENUM (
      'PENDING',
      'PAID',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  full_name TEXT NOT NULL,
  job_title TEXT,
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  payroll_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payroll_staff_profiles_school
  ON payroll_staff_profiles(school_id, payroll_active)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_number TEXT,
  period_label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  payroll_status payroll_run_status NOT NULL DEFAULT 'DRAFT',
  currency_code TEXT NOT NULL DEFAULT 'USD',
  total_gross NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_net NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_school_number
  ON payroll_runs(school_id, payroll_number)
  WHERE deleted_at IS NULL AND payroll_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_runs_school
  ON payroll_runs(school_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
  payroll_staff_profile_id UUID NOT NULL REFERENCES payroll_staff_profiles(id),
  gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status payroll_payment_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_items_run
  ON payroll_run_items(payroll_run_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_run_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_payroll_number(p_school_id UUID)
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
    INSERT INTO payroll_run_sequences (
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
      last_number = payroll_run_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    v_candidate_number :=
      'PAYROLL-' || v_year::TEXT || '-' || LPAD(v_next_number::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM payroll_runs
      WHERE school_id = p_school_id
        AND deleted_at IS NULL
        AND payroll_number = v_candidate_number
    );
  END LOOP;

  RETURN v_candidate_number;
END;
$$;
