BEGIN;

DO $$
BEGIN
  CREATE TYPE password_reset_status AS ENUM ('PENDING', 'CONSUMED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash CHAR(64) NOT NULL UNIQUE,
  reset_status password_reset_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  email_send_count INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ,
  email_delivery_status TEXT,
  email_delivery_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_password_reset_expiration CHECK (expires_at > requested_at)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
  ON password_reset_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_pending
  ON password_reset_requests(token_hash, expires_at) WHERE reset_status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_password_reset_per_user
  ON password_reset_requests(user_id) WHERE reset_status = 'PENDING';

COMMIT;