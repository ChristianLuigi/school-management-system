BEGIN;

ALTER TABLE school_staff_accounts
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_region TEXT,
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_country_code TEXT;

ALTER TABLE school_staff_accounts
  DROP CONSTRAINT IF EXISTS school_staff_accounts_country_code_check,
  ADD CONSTRAINT school_staff_accounts_country_code_check
  CHECK (
    address_country_code IS NULL
    OR address_country_code ~ '^[A-Z]{2}$'
  );

ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS staff_account_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_invitation_staff_school'
      AND conrelid = 'user_invitations'::REGCLASS
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT fk_user_invitation_staff_school
      FOREIGN KEY (staff_account_id, school_id)
      REFERENCES school_staff_accounts(id, school_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_staff_account_invitation
  ON user_invitations(school_id, staff_account_id)
  WHERE staff_account_id IS NOT NULL
    AND invitation_status = 'PENDING';

CREATE TABLE IF NOT EXISTS staff_medical_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  allergies_or_conditions TEXT,
  accommodation_notes TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_staff_medical_information_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_medical_information
  ON staff_medical_information(school_id, staff_account_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION normalize_staff_operational_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.address_line_1 := NULLIF(BTRIM(NEW.address_line_1), '');
  NEW.address_line_2 := NULLIF(BTRIM(NEW.address_line_2), '');
  NEW.address_city := NULLIF(BTRIM(NEW.address_city), '');
  NEW.address_region := NULLIF(BTRIM(NEW.address_region), '');
  NEW.address_postal_code := NULLIF(BTRIM(NEW.address_postal_code), '');
  NEW.address_country_code := UPPER(
    NULLIF(BTRIM(NEW.address_country_code), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_staff_operational_workspace
  ON school_staff_accounts;

CREATE TRIGGER trg_normalize_staff_operational_workspace
BEFORE INSERT OR UPDATE OF
  address_line_1,
  address_line_2,
  address_city,
  address_region,
  address_postal_code,
  address_country_code
ON school_staff_accounts
FOR EACH ROW
EXECUTE FUNCTION normalize_staff_operational_workspace();

CREATE OR REPLACE FUNCTION touch_staff_medical_information()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.emergency_contact_name := NULLIF(
    BTRIM(NEW.emergency_contact_name),
    ''
  );
  NEW.emergency_contact_relationship := NULLIF(
    BTRIM(NEW.emergency_contact_relationship),
    ''
  );
  NEW.emergency_contact_phone := NULLIF(
    BTRIM(NEW.emergency_contact_phone),
    ''
  );
  NEW.allergies_or_conditions := NULLIF(
    BTRIM(NEW.allergies_or_conditions),
    ''
  );
  NEW.accommodation_notes := NULLIF(
    BTRIM(NEW.accommodation_notes),
    ''
  );
  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_staff_medical_information
  ON staff_medical_information;

CREATE TRIGGER trg_touch_staff_medical_information
BEFORE INSERT OR UPDATE
ON staff_medical_information
FOR EACH ROW
EXECUTE FUNCTION touch_staff_medical_information();

COMMIT;
