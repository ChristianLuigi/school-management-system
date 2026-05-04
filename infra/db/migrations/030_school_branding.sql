ALTER TABLE schools
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS address_line1 TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS address_line2 TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS director_name TEXT;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS report_card_title_i18n JSONB NOT NULL DEFAULT '{"fr":"Bulletin scolaire","en":"Student Report Card"}'::jsonb;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS report_card_footer_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS branding_updated_by_user_id UUID REFERENCES users(id);

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS branding_updated_at TIMESTAMPTZ;
