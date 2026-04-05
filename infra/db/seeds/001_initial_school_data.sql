-- =========================================================
-- INITIAL SEED DATA
-- =========================================================

-- 1) SCHOOL
INSERT INTO schools (
    id,
    code,
    name,
    default_locale,
    supported_locales,
    timezone,
    currency_code,
    country_code,
    is_active
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'ALPHA-SCHOOL',
    'Alpha International School',
    'fr',
    '["fr","en"]'::jsonb,
    'America/Port-au-Prince',
    'HTG',
    'HT',
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- 2) DEFAULT GRADING CONFIGURATION
INSERT INTO grading_configurations (
    id,
    school_id,
    name_i18n,
    max_score,
    passing_score,
    rounding_precision,
    rounding_mode,
    is_default
)
VALUES (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    '{"fr":"Barème sur 20","en":"20-point scale"}'::jsonb,
    20,
    10,
    2,
    'HALF_UP',
    TRUE
)
ON CONFLICT DO NOTHING;

-- 3) ACADEMIC YEAR
INSERT INTO academic_years (
    id,
    school_id,
    name_i18n,
    start_date,
    end_date,
    status
)
VALUES (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    '{"fr":"Année scolaire 2025-2026","en":"Academic Year 2025-2026"}'::jsonb,
    '2025-09-01',
    '2026-06-30',
    'ACTIVE'
)
ON CONFLICT DO NOTHING;

-- 4) GRADING PERIODS
INSERT INTO grading_periods (
    id,
    academic_year_id,
    period_type,
    sequence_no,
    name_i18n,
    start_date,
    end_date,
    is_current
)
VALUES
(
    '44444444-4444-4444-8444-444444444441',
    '33333333-3333-4333-8333-333333333333',
    'TRIMESTER',
    1,
    '{"fr":"1er Trimestre","en":"Trimester 1"}'::jsonb,
    '2025-09-01',
    '2025-11-30',
    FALSE
),
(
    '44444444-4444-4444-8444-444444444442',
    '33333333-3333-4333-8333-333333333333',
    'TRIMESTER',
    2,
    '{"fr":"2e Trimestre","en":"Trimester 2"}'::jsonb,
    '2025-12-01',
    '2026-02-28',
    FALSE
),
(
    '44444444-4444-4444-8444-444444444443',
    '33333333-3333-4333-8333-333333333333',
    'TRIMESTER',
    3,
    '{"fr":"3e Trimestre","en":"Trimester 3"}'::jsonb,
    '2026-03-01',
    '2026-06-30',
    TRUE
)
ON CONFLICT (academic_year_id, sequence_no) DO NOTHING;

-- 5) GRADE LEVELS
INSERT INTO grade_levels (
    id,
    school_id,
    code,
    name_i18n,
    display_order,
    grading_configuration_id
)
VALUES
(
    '55555555-5555-4555-8555-555555555561',
    '11111111-1111-4111-8111-111111111111',
    '6EME',
    '{"fr":"6ème","en":"Grade 6"}'::jsonb,
    1,
    '22222222-2222-4222-8222-222222222222'
),
(
    '55555555-5555-4555-8555-555555555562',
    '11111111-1111-4111-8111-111111111111',
    '5EME',
    '{"fr":"5ème","en":"Grade 5"}'::jsonb,
    2,
    '22222222-2222-4222-8222-222222222222'
),
(
    '55555555-5555-4555-8555-555555555563',
    '11111111-1111-4111-8111-111111111111',
    '4EME',
    '{"fr":"4ème","en":"Grade 4"}'::jsonb,
    3,
    '22222222-2222-4222-8222-222222222222'
)
ON CONFLICT (school_id, code) DO NOTHING;

-- 6) SECTIONS
INSERT INTO sections (
    id,
    school_id,
    academic_year_id,
    grade_level_id,
    code,
    name_i18n,
    homeroom_teacher_id
)
VALUES
(
    '66666666-6666-4666-8666-666666666671',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555561',
    'A',
    '{"fr":"6ème A","en":"Grade 6 A"}'::jsonb,
    NULL
),
(
    '66666666-6666-4666-8666-666666666672',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555561',
    'B',
    '{"fr":"6ème B","en":"Grade 6 B"}'::jsonb,
    NULL
),
(
    '66666666-6666-4666-8666-666666666673',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555562',
    'A',
    '{"fr":"5ème A","en":"Grade 5 A"}'::jsonb,
    NULL
)
ON CONFLICT (academic_year_id, grade_level_id, code) DO NOTHING;