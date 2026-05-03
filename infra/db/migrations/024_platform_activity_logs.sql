CREATE TABLE platform_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'SYSTEM',
  actor_user_id UUID REFERENCES users(id),
  school_id UUID REFERENCES schools(id),
  membership_id UUID REFERENCES school_memberships(id),
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_activity_logs_created_at
  ON platform_activity_logs(created_at DESC);

CREATE INDEX idx_platform_activity_logs_school_id
  ON platform_activity_logs(school_id);

CREATE INDEX idx_platform_activity_logs_event_type
  ON platform_activity_logs(event_type);
