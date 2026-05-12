ALTER TABLE students
ADD COLUMN IF NOT EXISTS student_code TEXT;

CREATE TABLE IF NOT EXISTS school_student_code_sequences (
  school_id UUID NOT NULL REFERENCES schools(id),
  code_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, code_year)
);

CREATE OR REPLACE FUNCTION next_student_code(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INT;
  v_next_number INT;
  v_candidate_code TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  LOOP
    INSERT INTO school_student_code_sequences (
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
      last_number = school_student_code_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    v_candidate_code :=
      'STU-' || v_year::TEXT || '-' || LPAD(v_next_number::TEXT, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM students
      WHERE school_id = p_school_id
        AND deleted_at IS NULL
        AND student_code = v_candidate_code
    );
  END LOOP;

  RETURN v_candidate_code;
END;
$$;

CREATE OR REPLACE FUNCTION assign_student_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_code IS NULL OR BTRIM(NEW.student_code) = '' THEN
    NEW.student_code := next_student_code(NEW.school_id);
  ELSE
    NEW.student_code := UPPER(BTRIM(NEW.student_code));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_student_code ON students;

CREATE TRIGGER trg_assign_student_code
BEFORE INSERT OR UPDATE OF student_code
ON students
FOR EACH ROW
EXECUTE FUNCTION assign_student_code();

DO $$
DECLARE
  v_student RECORD;
BEGIN
  FOR v_student IN
    SELECT id, school_id
    FROM students
    WHERE deleted_at IS NULL
      AND (student_code IS NULL OR BTRIM(student_code) = '')
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    UPDATE students
    SET student_code = next_student_code(v_student.school_id),
        updated_at = NOW()
    WHERE id = v_student.id;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM students
    WHERE deleted_at IS NULL
      AND student_code IS NOT NULL
    GROUP BY school_id, student_code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate student codes exist. Unique index was not created.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_student_code_active
      ON students(school_id, student_code)
      WHERE deleted_at IS NULL
        AND student_code IS NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_students_school_student_code
  ON students(school_id, student_code)
  WHERE deleted_at IS NULL;
