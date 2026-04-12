CREATE TABLE school_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  user_id UUID NOT NULL REFERENCES users(id),
  membership_status school_membership_status NOT NULL DEFAULT 'INVITED',
  job_title TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_school_memberships_school_id
  ON school_memberships(school_id);

CREATE INDEX idx_school_memberships_user_id
  ON school_memberships(user_id);

CREATE INDEX idx_school_memberships_status
  ON school_memberships(membership_status);

CREATE UNIQUE INDEX uq_school_memberships_school_user_active
  ON school_memberships(school_id, user_id)
  WHERE deleted_at IS NULL;