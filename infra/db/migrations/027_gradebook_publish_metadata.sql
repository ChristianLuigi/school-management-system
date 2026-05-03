ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS published_by_user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_gradebooks_published_at
  ON gradebooks(published_at)
  WHERE deleted_at IS NULL;
