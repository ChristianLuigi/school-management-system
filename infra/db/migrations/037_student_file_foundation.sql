ALTER TABLE students
ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS place_of_birth TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS previous_school_name TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS previous_school_address TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS photo_received BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS birth_certificate_received BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS vaccination_card_received BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS previous_school_record_received BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS vaccination_status TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS allergies TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS medical_notes TEXT;

ALTER TABLE students
ADD COLUMN IF NOT EXISTS special_needs TEXT;

CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  full_name TEXT NOT NULL,
  profession TEXT,
  phone_primary TEXT,
  phone_secondary TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  guardian_id UUID NOT NULL REFERENCES guardians(id),
  relationship TEXT NOT NULL,
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_authorized_pickup BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guardians_school
  ON guardians(school_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_guardians_student
  ON student_guardians(student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian
  ON student_guardians(guardian_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_school_birth_date
  ON students(school_id, date_of_birth)
  WHERE deleted_at IS NULL;
