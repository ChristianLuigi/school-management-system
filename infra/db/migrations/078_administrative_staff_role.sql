BEGIN;

-- Additive only: preserve all existing role identities and migration checksums.
ALTER TYPE school_role ADD VALUE IF NOT EXISTS 'ADMIN_STAFF';
ALTER TYPE school_staff_role ADD VALUE IF NOT EXISTS 'ADMIN_STAFF';

ALTER TABLE user_invitations DROP CONSTRAINT user_invitations_role_code_check;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_role_code_check
  CHECK (role_code IN ('SCHOOL_ADMIN', 'ADMIN_STAFF', 'TEACHER', 'FINANCE_ADMIN', 'PARENT'));

ALTER TABLE school_staff_accounts DROP CONSTRAINT school_staff_accounts_staff_type_check;
ALTER TABLE school_staff_accounts ADD CONSTRAINT school_staff_accounts_staff_type_check
  CHECK (staff_type IN ('SCHOOL_ADMIN', 'ADMIN_STAFF', 'TEACHER', 'FINANCE_ADMIN'));

ALTER TABLE staff_account_user_link_events DROP CONSTRAINT staff_account_user_link_events_role_code_check;
ALTER TABLE staff_account_user_link_events ADD CONSTRAINT staff_account_user_link_events_role_code_check
  CHECK (role_code IN ('SCHOOL_ADMIN', 'ADMIN_STAFF', 'TEACHER', 'FINANCE_ADMIN'));

-- Keep the existing staff-directory trigger; add only the new category mapping.
CREATE FUNCTION set_administrative_staff_category() RETURNS trigger AS $$
BEGIN
  IF NEW.staff_type = 'ADMIN_STAFF' AND NEW.staff_category = 'OTHER' THEN
    NEW.staff_category := 'ADMINISTRATIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_administrative_staff_category
  BEFORE INSERT OR UPDATE ON school_staff_accounts
  FOR EACH ROW EXECUTE FUNCTION set_administrative_staff_category();

COMMIT;
