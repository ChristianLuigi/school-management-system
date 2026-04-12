CREATE TYPE school_status AS ENUM (
  'DRAFT',
  'ACTIVE_SETUP',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

CREATE TYPE school_membership_status AS ENUM (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
);

CREATE TYPE school_staff_role AS ENUM (
  'SCHOOL_ADMIN',
  'TEACHER',
  'FINANCE_ADMIN'
);

CREATE TYPE school_invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED'
);