ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS profession TEXT;

ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS phone_primary TEXT;

ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS phone_secondary TEXT;

ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS address TEXT;

UPDATE guardians
SET full_name = NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), '')
WHERE full_name IS NULL;

UPDATE guardians
SET full_name = CONCAT('Guardian ', id::text)
WHERE full_name IS NULL;

ALTER TABLE guardians
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE guardians
ALTER COLUMN first_name DROP NOT NULL;

ALTER TABLE guardians
ALTER COLUMN last_name DROP NOT NULL;

ALTER TABLE guardians
ALTER COLUMN full_name SET NOT NULL;

ALTER TABLE student_guardians
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

ALTER TABLE student_guardians
ADD COLUMN IF NOT EXISTS relationship TEXT;

ALTER TABLE student_guardians
ADD COLUMN IF NOT EXISTS is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE student_guardians
ADD COLUMN IF NOT EXISTS is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE student_guardians
ADD COLUMN IF NOT EXISTS is_authorized_pickup BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE student_guardians sg
SET school_id = st.school_id
FROM students st
WHERE sg.school_id IS NULL
  AND st.id = sg.student_id;

UPDATE student_guardians
SET relationship = relationship_type
WHERE relationship IS NULL
  AND relationship_type IS NOT NULL;

UPDATE student_guardians
SET is_primary_contact = is_primary
WHERE is_primary_contact = FALSE
  AND is_primary = TRUE;

UPDATE student_guardians
SET is_authorized_pickup = can_pick_up
WHERE is_authorized_pickup = FALSE
  AND can_pick_up = TRUE;

ALTER TABLE student_guardians
ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE student_guardians
ALTER COLUMN relationship SET NOT NULL;

ALTER TABLE student_guardians
ALTER COLUMN relationship_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guardians_school
  ON guardians(school_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_guardians_school_student
  ON student_guardians(school_id, student_id)
  WHERE deleted_at IS NULL;

