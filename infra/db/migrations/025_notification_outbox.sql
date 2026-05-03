CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id),
  student_id UUID REFERENCES students(id),
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP',
  dedupe_key TEXT NOT NULL,
  recipient_email TEXT,
  recipient_user_id UUID REFERENCES users(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_outbox_dedupe_key
  ON notification_outbox(dedupe_key);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status
  ON notification_outbox(status);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_school_id
  ON notification_outbox(school_id);
