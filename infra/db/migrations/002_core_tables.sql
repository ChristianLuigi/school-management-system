-- =========================================================
-- SCHOOLS
-- =========================================================
CREATE TABLE schools (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
code VARCHAR(50) NOT NULL UNIQUE,
name VARCHAR(255) NOT NULL,
default_locale locale_code NOT NULL DEFAULT 'fr',
supported_locales JSONB NOT NULL DEFAULT '["fr","en"]'::jsonb,
timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
currency_code VARCHAR(3) NOT NULL,
country_code VARCHAR(2) NOT NULL,
is_active BOOLEAN NOT NULL DEFAULT TRUE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL


);

CREATE TRIGGER trg_schools_updated_at
BEFORE UPDATE ON schools
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- USERS / ROLES
-- =========================================================
CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
email VARCHAR(255) NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
preferred_locale locale_code NOT NULL DEFAULT 'fr',
status user_status NOT NULL DEFAULT 'INVITED',
last_login_at TIMESTAMPTZ NULL,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL


);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
CREATE TABLE school_user_roles (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
user_id UUID NOT NULL REFERENCES users(id),
role school_role NOT NULL,
is_primary BOOLEAN NOT NULL DEFAULT FALSE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_school_user_role UNIQUE (school_id, user_id, role)


);

CREATE TRIGGER trg_school_user_roles_updated_at
BEFORE UPDATE ON school_user_roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- GRADING CONFIGURATION
-- =========================================================
CREATE TABLE grading_configurations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
name_i18n JSONB NOT NULL,
max_score NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
passing_score NUMERIC(6,2) NOT NULL CHECK (passing_score >= 0),
rounding_precision SMALLINT NOT NULL DEFAULT 2 CHECK (rounding_precision BETWEEN 0 AND 4),
rounding_mode VARCHAR(20) NOT NULL DEFAULT 'HALF_UP',
letter_grade_map JSONB NULL,
is_default BOOLEAN NOT NULL DEFAULT FALSE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL


);

CREATE TRIGGER trg_grading_configurations_updated_at
BEFORE UPDATE ON grading_configurations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX uq_grading_config_default_per_school
ON grading_configurations(school_id)
WHERE is_default = TRUE AND deleted_at IS NULL;
