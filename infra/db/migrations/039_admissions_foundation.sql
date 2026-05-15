CREATE TABLE IF NOT EXISTS admission_application_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_admission_application_number(p_school_id UUID)
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
    INSERT INTO admission_application_sequences (
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
      last_number = admission_application_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    v_candidate_number :=
      'ADM-' || v_year::TEXT || '-' || LPAD(v_next_number::TEXT, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM admission_applications
      WHERE school_id = p_school_id
        AND deleted_at IS NULL
        AND application_number = v_candidate_number
    );
  END LOOP;

  RETURN v_candidate_number;
END;
$$;

CREATE TABLE IF NOT EXISTS admission_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  application_number TEXT NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id),
  desired_grade_level_id UUID REFERENCES grade_levels(id),
  desired_section_id UUID REFERENCES sections(id),

  admission_status TEXT NOT NULL DEFAULT 'APPLICATION_SUBMITTED',

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth DATE,
  place_of_birth TEXT,

  previous_school_name TEXT,
  previous_school_address TEXT,

  parent_full_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  parent_profession TEXT,
  parent_address TEXT,

  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,

  photo_received BOOLEAN NOT NULL DEFAULT FALSE,
  birth_certificate_received BOOLEAN NOT NULL DEFAULT FALSE,
  vaccination_card_received BOOLEAN NOT NULL DEFAULT FALSE,
  previous_school_record_received BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id_document_received BOOLEAN NOT NULL DEFAULT FALSE,
  conduct_certificate_received BOOLEAN NOT NULL DEFAULT FALSE,

  notes TEXT,

  converted_student_id UUID REFERENCES students(id),
  created_by_user_id UUID REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_admission_applications_status
  CHECK (
    admission_status IN (
      'PROSPECT',
      'APPLICATION_SUBMITTED',
      'DOCUMENTS_INCOMPLETE',
      'PENDING_PAYMENT',
      'PENDING_EXAM',
      'EXAM_SCHEDULED',
      'ADMITTED',
      'CONDITIONALLY_ADMITTED',
      'WAITLISTED',
      'REJECTED',
      'CONFIRMED',
      'CONVERTED_TO_STUDENT',
      'CANCELLED'
    )
  ),

  CONSTRAINT chk_admission_applications_gender
  CHECK (
    gender IS NULL OR gender IN ('MALE', 'FEMALE')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_applications_school_number_active
  ON admission_applications(school_id, application_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admission_applications_school_status
  ON admission_applications(school_id, admission_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admission_applications_school_created
  ON admission_applications(school_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS admission_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  admission_application_id UUID NOT NULL REFERENCES admission_applications(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by_user_id UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admission_status_history_application
  ON admission_status_history(admission_application_id, changed_at DESC)
  WHERE deleted_at IS NULL;
