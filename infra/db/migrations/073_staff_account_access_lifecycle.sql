BEGIN;

CREATE TABLE IF NOT EXISTS staff_account_user_link_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('LINKED', 'UNLINKED')
  ),
  role_code TEXT NOT NULL CHECK (
    role_code IN (
      'SCHOOL_ADMIN',
      'TEACHER',
      'FINANCE_ADMIN'
    )
  ),
  invitation_id UUID REFERENCES user_invitations(id),
  actor_user_id UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_staff_account_user_link_event_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_account_user_link_events_staff
  ON staff_account_user_link_events(
    school_id,
    staff_account_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_staff_account_user_link_events_user
  ON staff_account_user_link_events(
    school_id,
    user_id,
    created_at DESC
  );

CREATE OR REPLACE FUNCTION reject_staff_account_user_link_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Staff account link history is append-only.';
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_account_user_link_events_append_only
  ON staff_account_user_link_events;

CREATE TRIGGER trg_staff_account_user_link_events_append_only
BEFORE UPDATE OR DELETE
ON staff_account_user_link_events
FOR EACH ROW
EXECUTE FUNCTION reject_staff_account_user_link_event_mutation();

COMMIT;
