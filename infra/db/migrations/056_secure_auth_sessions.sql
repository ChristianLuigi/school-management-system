BEGIN;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS authentication_version INTEGER,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idle_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

UPDATE auth_sessions
SET
  authentication_version = COALESCE(authentication_version, 1),
  last_seen_at = COALESCE(last_seen_at, last_used_at, created_at),
  idle_expires_at = COALESCE(idle_expires_at, expires_at),
  revoked_at = COALESCE(revoked_at, NOW()),
  revocation_reason = COALESCE(revocation_reason, 'LEGACY_SESSION_INVALIDATED');

ALTER TABLE auth_sessions
  ALTER COLUMN authentication_version SET NOT NULL,
  ALTER COLUMN last_seen_at SET NOT NULL,
  ALTER COLUMN last_seen_at SET DEFAULT NOW(),
  ALTER COLUMN idle_expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_token
  ON auth_sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiration
  ON auth_sessions(expires_at, idle_expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS authentication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  email_normalized TEXT,
  success BOOLEAN NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_authentication_events_user
  ON authentication_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_authentication_events_email
  ON authentication_events(email_normalized, created_at DESC);

COMMIT;
