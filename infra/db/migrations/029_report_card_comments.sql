ALTER TABLE report_cards
ADD COLUMN IF NOT EXISTS teacher_comment TEXT;

ALTER TABLE report_cards
ADD COLUMN IF NOT EXISTS director_comment TEXT;

ALTER TABLE report_cards
ADD COLUMN IF NOT EXISTS final_decision_override TEXT;

ALTER TABLE report_cards
ADD COLUMN IF NOT EXISTS final_remarks TEXT;

ALTER TABLE report_cards
ADD COLUMN IF NOT EXISTS comments_updated_by_user_id UUID REFERENCES users(id);

ALTER TABLE report_cards
ADD COLUMN IF NOT EXISTS comments_updated_at TIMESTAMPTZ;
