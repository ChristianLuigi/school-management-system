CREATE TABLE school_membership_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_membership_id UUID NOT NULL REFERENCES school_memberships(id),
  role school_staff_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_school_membership_roles_membership_id
  ON school_membership_roles(school_membership_id);

CREATE UNIQUE INDEX uq_school_membership_roles_active
  ON school_membership_roles(school_membership_id, role)
  WHERE deleted_at IS NULL;