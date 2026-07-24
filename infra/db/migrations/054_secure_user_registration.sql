BEGIN;

DO $$ BEGIN
  CREATE TYPE user_account_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE email_outbox_status AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_original TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS account_status user_account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authentication_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET
  email_original = COALESCE(email_original, email),
  email_normalized = COALESCE(email_normalized, LOWER(BTRIM(email))),
  account_status = CASE WHEN status::text = 'ACTIVE' THEN 'ACTIVE'::user_account_status ELSE account_status END
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_normalized_active
  ON users(email_normalized) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  invited_by_user_id UUID NOT NULL REFERENCES users(id),
  email_original TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role_code TEXT NOT NULL CHECK (role_code IN ('SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN', 'PARENT')),
  locale TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  invitation_status invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  send_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invitation_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_user_invitations_lookup ON user_invitations(school_id, email_normalized);
CREATE INDEX IF NOT EXISTS idx_user_invitations_pending ON user_invitations(invitation_status, expires_at) WHERE invitation_status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_user_invitation ON user_invitations(school_id, email_normalized, role_code) WHERE invitation_status = 'PENDING';

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en')),
  template_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  outbox_status email_outbox_status NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending ON email_outbox(next_attempt_at, created_at) WHERE outbox_status IN ('PENDING', 'FAILED');

COMMIT;
