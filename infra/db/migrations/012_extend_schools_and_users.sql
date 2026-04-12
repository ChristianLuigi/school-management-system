ALTER TABLE schools
ADD COLUMN IF NOT EXISTS status school_status NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_schools_status
  ON schools(status);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);