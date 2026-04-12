DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_user_role') THEN
    CREATE TYPE platform_user_role AS ENUM ('SUPER_ADMIN');
  END IF;
END
$$;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS platform_role platform_user_role;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_sessions_token_hash
  ON auth_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
  ON auth_sessions(user_id);