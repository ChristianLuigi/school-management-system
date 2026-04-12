CREATE TABLE school_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  invited_role school_staff_role NOT NULL,
  invited_by_user_id UUID REFERENCES users(id),
  token_hash TEXT NOT NULL,
  invitation_status school_invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_school_invitations_school_id
  ON school_invitations(school_id);

CREATE INDEX idx_school_invitations_email
  ON school_invitations(email);

CREATE INDEX idx_school_invitations_status
  ON school_invitations(invitation_status);

CREATE UNIQUE INDEX uq_school_invitations_token_hash
  ON school_invitations(token_hash);