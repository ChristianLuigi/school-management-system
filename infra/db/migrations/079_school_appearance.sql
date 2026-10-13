BEGIN;
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#1d4ed8',
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#0f766e',
  ADD COLUMN IF NOT EXISTS default_theme TEXT NOT NULL DEFAULT 'light';
ALTER TABLE schools
  ADD CONSTRAINT schools_primary_color_format CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT schools_accent_color_format CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT schools_default_theme_value CHECK (default_theme IN ('light', 'dark', 'system'));
COMMIT;
