\set ON_ERROR_STOP on

-- Minimal, connected dataset for the final client demonstration.
-- Prerequisites: run all migrations through 052 before this seed.
-- Safe to rerun: every demo entity uses a fixed ID and is upserted.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.gradebook_assessments') IS NULL
    OR to_regclass('public.gradebook_scores') IS NULL THEN
    RAISE EXCEPTION
      'Demo seed requires migrations 051_gradebook_mvp.sql and 052_subject_setup_by_grade_level.sql.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- School and setup
-- -----------------------------------------------------------------------------

INSERT INTO schools (
  id,
  code,
  name,
  default_locale,
  supported_locales,
  timezone,
  currency_code,
  country_code,
  is_active,
  status,
  management_mode,
  address_line1,
  city,
  phone,
  email,
  director_name
)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'DEMO-ALMAC',
  U&'Institution D\00E9mo ALMAC',
  'fr',
  '["fr","en"]'::jsonb,
  'America/Port-au-Prince',
  'USD',
  'HT',
  TRUE,
  'ACTIVE',
  'SUPERADMIN_MANAGED',
  'Delmas, Port-au-Prince',
  'Port-au-Prince',
  '+509 37 00 0000',
  'demo@almac.local',
  U&'Direction ALMAC'
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  default_locale = EXCLUDED.default_locale,
  supported_locales = EXCLUDED.supported_locales,
  timezone = EXCLUDED.timezone,
  currency_code = EXCLUDED.currency_code,
  country_code = EXCLUDED.country_code,
  is_active = TRUE,
  status = 'ACTIVE',
  management_mode = 'SUPERADMIN_MANAGED',
  address_line1 = EXCLUDED.address_line1,
  city = EXCLUDED.city,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  director_name = EXCLUDED.director_name,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO school_finance_settings (
  id,
  school_id,
  default_currency_code,
  default_invoice_due_days,
  invoice_footer_i18n,
  receipt_footer_i18n
)
VALUES (
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'USD',
  30,
  jsonb_build_object('fr', U&'Merci pour votre confiance.', 'en', 'Thank you.'),
  jsonb_build_object('fr', U&'Merci pour votre paiement.', 'en', 'Thank you for your payment.')
)
ON CONFLICT (id) DO UPDATE SET
  default_currency_code = 'USD',
  default_invoice_due_days = 30,
  invoice_footer_i18n = EXCLUDED.invoice_footer_i18n,
  receipt_footer_i18n = EXCLUDED.receipt_footer_i18n,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO school_academic_structure_settings (
  school_id,
  include_kindergarten,
  include_primary,
  include_secondary,
  structure_mode,
  configured_at,
  configured_by_user_id
)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  TRUE,
  TRUE,
  TRUE,
  'HAITIAN_STANDARD',
  NOW(),
  '94444444-4444-4444-8444-444444444444'
)
ON CONFLICT (school_id) DO UPDATE SET
  include_kindergarten = TRUE,
  include_primary = TRUE,
  include_secondary = TRUE,
  structure_mode = 'HAITIAN_STANDARD',
  configured_at = NOW(),
  configured_by_user_id = EXCLUDED.configured_by_user_id,
  updated_at = NOW();

INSERT INTO school_levels (
  id,
  school_id,
  code,
  name_i18n,
  display_order,
  is_active
)
VALUES
  (
    'a1100000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'MATERNELLE',
    jsonb_build_object('fr', 'Maternelle', 'en', 'Kindergarten'),
    10,
    TRUE
  ),
  (
    'a1100000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'PRIMAIRE',
    jsonb_build_object('fr', 'Primaire', 'en', 'Primary'),
    20,
    TRUE
  ),
  (
    'a1100000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'SECONDAIRE',
    jsonb_build_object('fr', 'Secondaire', 'en', 'Secondary'),
    30,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name_i18n = EXCLUDED.name_i18n,
  display_order = EXCLUDED.display_order,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = NOW();

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
  'a1200000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  jsonb_build_object('fr', U&'Bar\00E8me sur 20', 'en', '20-point scale'),
  20,
  10,
  2,
  'HALF_UP',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name_i18n = EXCLUDED.name_i18n,
  max_score = 20,
  passing_score = 10,
  rounding_precision = 2,
  rounding_mode = 'HALF_UP',
  is_default = TRUE,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO academic_years (
  id,
  school_id,
  name_i18n,
  start_date,
  end_date,
  status
)
VALUES (
  'a1300000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  jsonb_build_object('fr', U&'Ann\00E9e scolaire 2025-2026', 'en', 'Academic Year 2025-2026'),
  '2025-09-01',
  '2026-07-31',
  'ACTIVE'
)
ON CONFLICT (id) DO UPDATE SET
  name_i18n = EXCLUDED.name_i18n,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  status = 'ACTIVE',
  deleted_at = NULL,
  updated_at = NOW();

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
    'a1310000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'TRIMESTER',
    1,
    jsonb_build_object('fr', '1er Trimestre', 'en', 'Trimester 1'),
    '2025-09-01',
    '2025-12-31',
    FALSE
  ),
  (
    'a1310000-0000-4000-8000-000000000002',
    'a1300000-0000-4000-8000-000000000001',
    'TRIMESTER',
    2,
    jsonb_build_object('fr', U&'2e Trimestre', 'en', 'Trimester 2'),
    '2026-01-01',
    '2026-03-31',
    FALSE
  ),
  (
    'a1310000-0000-4000-8000-000000000003',
    'a1300000-0000-4000-8000-000000000001',
    'TRIMESTER',
    3,
    jsonb_build_object('fr', '3e Trimestre', 'en', 'Trimester 3'),
    '2026-04-01',
    '2026-07-31',
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name_i18n = EXCLUDED.name_i18n,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_current = EXCLUDED.is_current,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO grade_levels (
  id,
  school_id,
  school_level_id,
  code,
  name_i18n,
  display_order,
  grading_configuration_id,
  academic_division
)
VALUES
  (
    'a1400000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'KG1',
    jsonb_build_object('fr', 'Maternelle 1', 'en', 'Kindergarten 1'),
    10,
    'a1200000-0000-4000-8000-000000000001',
    'KINDERGARTEN'
  ),
  (
    'a1400000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000002',
    'G1',
    jsonb_build_object('fr', U&'1re Ann\00E9e', 'en', '1st Grade'),
    110,
    'a1200000-0000-4000-8000-000000000001',
    'PRIMARY'
  ),
  (
    'a1400000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000003',
    'G7',
    jsonb_build_object('fr', U&'7e Ann\00E9e', 'en', '7th Grade'),
    210,
    'a1200000-0000-4000-8000-000000000001',
    'SECONDARY'
  ),
  (
    'a1400000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000003',
    'NS1',
    jsonb_build_object('fr', 'NS1', 'en', 'NS1'),
    240,
    'a1200000-0000-4000-8000-000000000001',
    'SECONDARY'
  )
ON CONFLICT (id) DO UPDATE SET
  school_level_id = EXCLUDED.school_level_id,
  name_i18n = EXCLUDED.name_i18n,
  display_order = EXCLUDED.display_order,
  grading_configuration_id = EXCLUDED.grading_configuration_id,
  academic_division = EXCLUDED.academic_division,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO sections (
  id,
  school_id,
  academic_year_id,
  grade_level_id,
  code,
  name_i18n,
  display_order,
  capacity,
  room_label
)
VALUES
  (
    'a1500000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000001',
    'KG1-A',
    jsonb_build_object('fr', 'Maternelle 1 - A', 'en', 'Kindergarten 1 - A'),
    1,
    20,
    'Salle M1-A'
  ),
  (
    'a1500000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000002',
    'G1-A',
    jsonb_build_object('fr', U&'1re Ann\00E9e - A', 'en', '1st Grade - A'),
    1,
    30,
    'Salle P1-A'
  ),
  (
    'a1500000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000002',
    'G1-B',
    jsonb_build_object('fr', U&'1re Ann\00E9e - B', 'en', '1st Grade - B'),
    2,
    30,
    'Salle P1-B'
  ),
  (
    'a1500000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000003',
    'G7-A',
    jsonb_build_object('fr', U&'7e Ann\00E9e - A', 'en', '7th Grade - A'),
    1,
    35,
    'Salle S7-A'
  ),
  (
    'a1500000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000004',
    'NS1-A',
    jsonb_build_object('fr', 'NS1 - A', 'en', 'NS1 - A'),
    1,
    35,
    'Salle NS1-A'
  )
ON CONFLICT (id) DO UPDATE SET
  name_i18n = EXCLUDED.name_i18n,
  display_order = EXCLUDED.display_order,
  capacity = EXCLUDED.capacity,
  room_label = EXCLUDED.room_label,
  deleted_at = NULL,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Subjects and grade-level coefficients
-- -----------------------------------------------------------------------------

INSERT INTO school_subjects (
  id,
  school_id,
  code,
  name_i18n,
  description,
  subject_active
)
VALUES
  (
    'a1600000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'MATH',
    jsonb_build_object('fr', U&'Math\00E9matiques', 'en', 'Mathematics'),
    U&'Math\00E9matiques - niveau primaire',
    TRUE
  ),
  (
    'a1600000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'FR',
    jsonb_build_object('fr', U&'Fran\00E7ais', 'en', 'French'),
    U&'Fran\00E7ais - niveau primaire',
    TRUE
  ),
  (
    'a1600000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'ANG',
    jsonb_build_object('fr', 'Anglais', 'en', 'English'),
    'Anglais - niveau primaire',
    TRUE
  ),
  (
    'a1600000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000001',
    'SC-SOC',
    jsonb_build_object('fr', 'Sciences sociales', 'en', 'Social Studies'),
    'Sciences sociales - niveau primaire',
    TRUE
  ),
  (
    'a1600000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000001',
    'INFO',
    jsonb_build_object('fr', 'Informatique', 'en', 'Computer Science'),
    'Informatique - niveau primaire',
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name_i18n = EXCLUDED.name_i18n,
  description = EXCLUDED.description,
  subject_active = TRUE,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO grade_level_subjects (
  id,
  school_id,
  grade_level_id,
  subject_id,
  coefficient,
  display_order,
  is_required
)
VALUES
  ('a1700000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-000000000002', 'a1600000-0000-4000-8000-000000000001', 5, 10, TRUE),
  ('a1700000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-000000000002', 'a1600000-0000-4000-8000-000000000002', 4, 20, TRUE),
  ('a1700000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-000000000002', 'a1600000-0000-4000-8000-000000000003', 3, 30, TRUE),
  ('a1700000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-000000000002', 'a1600000-0000-4000-8000-000000000004', 2, 40, TRUE),
  ('a1700000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-000000000002', 'a1600000-0000-4000-8000-000000000005', 2, 50, TRUE)
ON CONFLICT (id) DO UPDATE SET
  coefficient = EXCLUDED.coefficient,
  display_order = EXCLUDED.display_order,
  is_required = TRUE,
  deleted_at = NULL,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Student, guardian, and enrollment
-- -----------------------------------------------------------------------------

INSERT INTO students (
  id,
  school_id,
  student_number,
  student_code,
  first_name,
  last_name,
  date_of_birth,
  gender,
  admission_date,
  status,
  place_of_birth,
  photo_received,
  birth_certificate_received,
  vaccination_card_received,
  vaccination_status,
  medical_notes
)
VALUES
  (
    'a1800000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'ALMAC-2026-001',
    'ALMAC-2026-001',
    'Marc',
    'Jean Baptiste',
    '2018-04-12',
    'MALE',
    '2025-09-01',
    'ACTIVE',
    'Port-au-Prince',
    TRUE,
    TRUE,
    TRUE,
    'UP_TO_DATE',
    U&'Aucune note m\00E9dicale particuli\00E8re.'
  ),
  (
    'a1800000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'ALMAC-2026-002',
    'ALMAC-2026-002',
    'Sarah',
    'Louis',
    '2018-07-20',
    'FEMALE',
    '2025-09-01',
    'ACTIVE',
    'Delmas',
    TRUE,
    TRUE,
    TRUE,
    'UP_TO_DATE',
    U&'Aucune note m\00E9dicale particuli\00E8re.'
  )
ON CONFLICT (id) DO UPDATE SET
  student_number = EXCLUDED.student_number,
  student_code = EXCLUDED.student_code,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  admission_date = EXCLUDED.admission_date,
  status = 'ACTIVE',
  place_of_birth = EXCLUDED.place_of_birth,
  photo_received = TRUE,
  birth_certificate_received = TRUE,
  vaccination_card_received = TRUE,
  vaccination_status = EXCLUDED.vaccination_status,
  medical_notes = EXCLUDED.medical_notes,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO student_documents (
  id,
  school_id,
  student_id,
  document_type,
  document_status,
  received_at,
  verified_at,
  uploaded_by_user_id,
  verified_by_user_id,
  notes
)
VALUES
  (
    'a1801000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a1800000-0000-4000-8000-000000000001',
    'BIRTH_CERTIFICATE',
    'RECEIVED',
    '2025-08-20',
    '2025-08-20 10:00:00-04',
    '94444444-4444-4444-8444-444444444444',
    '94444444-4444-4444-8444-444444444444',
    U&'Acte de naissance v\00E9rifi\00E9.'
  ),
  (
    'a1801000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'a1800000-0000-4000-8000-000000000001',
    'VACCINATION_CARD',
    'RECEIVED',
    '2025-08-20',
    '2025-08-20 10:05:00-04',
    '94444444-4444-4444-8444-444444444444',
    '94444444-4444-4444-8444-444444444444',
    U&'Carnet de vaccination v\00E9rifi\00E9.'
  ),
  (
    'a1801000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'a1800000-0000-4000-8000-000000000001',
    'PHOTO',
    'RECEIVED',
    '2025-08-20',
    '2025-08-20 10:10:00-04',
    '94444444-4444-4444-8444-444444444444',
    '94444444-4444-4444-8444-444444444444',
    U&'Photo d\0027identit\00E9 re\00E7ue.'
  )
ON CONFLICT (id) DO UPDATE SET
  document_status = 'RECEIVED',
  received_at = EXCLUDED.received_at,
  verified_at = EXCLUDED.verified_at,
  uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
  verified_by_user_id = EXCLUDED.verified_by_user_id,
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();
INSERT INTO guardians (
  id,
  school_id,
  first_name,
  last_name,
  phone,
  full_name,
  profession,
  phone_primary,
  email,
  address
)
VALUES (
  'a1810000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Marie',
  'Baptiste',
  '+509 37 00 0000',
  'Marie Baptiste',
  U&'Commer\00E7ante',
  '+509 37 00 0000',
  'marie.baptiste@example.com',
  'Delmas, Port-au-Prince'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  full_name = EXCLUDED.full_name,
  profession = EXCLUDED.profession,
  phone_primary = EXCLUDED.phone_primary,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO student_guardians (
  id,
  school_id,
  student_id,
  guardian_id,
  relationship_type,
  relationship,
  is_primary,
  can_pick_up,
  can_view_finance,
  can_view_academics,
  is_primary_contact,
  is_emergency_contact,
  is_authorized_pickup
)
VALUES (
  'a1820000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1800000-0000-4000-8000-000000000001',
  'a1810000-0000-4000-8000-000000000001',
  'MOTHER',
  'MOTHER',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  relationship_type = 'MOTHER',
  relationship = 'MOTHER',
  is_primary = TRUE,
  can_pick_up = TRUE,
  can_view_finance = TRUE,
  can_view_academics = TRUE,
  is_primary_contact = TRUE,
  is_emergency_contact = TRUE,
  is_authorized_pickup = TRUE,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO enrollments (
  id,
  student_id,
  academic_year_id,
  grade_level_id,
  section_id,
  enrollment_status,
  start_date
)
VALUES
  (
    'a1830000-0000-4000-8000-000000000001',
    'a1800000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000002',
    'a1500000-0000-4000-8000-000000000002',
    'ACTIVE',
    '2025-09-01'
  ),
  (
    'a1830000-0000-4000-8000-000000000002',
    'a1800000-0000-4000-8000-000000000002',
    'a1300000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000002',
    'a1500000-0000-4000-8000-000000000002',
    'ACTIVE',
    '2025-09-01'
  )
ON CONFLICT (id) DO UPDATE SET
  grade_level_id = EXCLUDED.grade_level_id,
  section_id = EXCLUDED.section_id,
  enrollment_status = 'ACTIVE',
  start_date = EXCLUDED.start_date,
  end_date = NULL,
  deleted_at = NULL,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Finance: one partially paid invoice and one printable receipt
-- -----------------------------------------------------------------------------

INSERT INTO invoices (
  id,
  school_id,
  student_id,
  academic_year_id,
  grading_period_id,
  invoice_number,
  invoice_title,
  status,
  invoice_status,
  issue_date,
  due_date,
  currency_code,
  subtotal_amount,
  discount_amount,
  total_amount,
  amount_paid,
  balance_due,
  notes,
  created_by_user_id
)
VALUES (
  'a1900000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1800000-0000-4000-8000-000000000001',
  'a1300000-0000-4000-8000-000000000001',
  'a1310000-0000-4000-8000-000000000003',
  'INV-DEMO-2026-001',
  U&'Frais de scolarit\00E9 Juin 2026',
  'PARTIALLY_PAID',
  'PARTIALLY_PAID',
  '2026-06-01',
  '2026-06-30',
  'USD',
  500,
  0,
  500,
  200,
  300,
  U&'Sc\00E9nario de d\00E9monstration ALMAC.',
  '94444444-4444-4444-8444-444444444444'
)
ON CONFLICT (id) DO UPDATE SET
  invoice_title = EXCLUDED.invoice_title,
  status = 'PARTIALLY_PAID',
  invoice_status = 'PARTIALLY_PAID',
  issue_date = EXCLUDED.issue_date,
  due_date = EXCLUDED.due_date,
  currency_code = 'USD',
  subtotal_amount = 500,
  discount_amount = 0,
  total_amount = 500,
  amount_paid = 200,
  balance_due = 300,
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO invoice_items (
  id,
  school_id,
  invoice_id,
  description,
  quantity,
  unit_amount,
  line_total
)
VALUES (
  'a1901000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1900000-0000-4000-8000-000000000001',
  U&'Frais de scolarit\00E9 - Juin 2026',
  1,
  500,
  500
)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  quantity = 1,
  unit_amount = 500,
  line_total = 500,
  deleted_at = NULL,
  updated_at = NOW();
INSERT INTO payments (
  id,
  school_id,
  invoice_id,
  student_id,
  payment_date,
  amount,
  payment_method,
  method,
  payment_reference,
  reference,
  reference_no,
  payment_number,
  receipt_number,
  receipt_generated_at,
  recorded_by_user_id,
  received_by_user_id,
  status,
  payment_status,
  paid_at,
  notes
)
VALUES (
  'a1910000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1900000-0000-4000-8000-000000000001',
  'a1800000-0000-4000-8000-000000000001',
  '2026-06-15 10:00:00-04',
  200,
  'CASH',
  'CASH',
  'CASH-DEMO-001',
  'CASH-DEMO-001',
  'CASH-DEMO-001',
  'PAY-DEMO-2026-001',
  'REC-DEMO-2026-001',
  '2026-06-15 10:00:00-04',
  '94444444-4444-4444-8444-444444444444',
  '94444444-4444-4444-8444-444444444444',
  'RECORDED',
  'CONFIRMED',
  '2026-06-15 10:00:00-04',
  U&'Paiement partiel de d\00E9monstration.'
)
ON CONFLICT (id) DO UPDATE SET
  amount = 200,
  payment_method = 'CASH',
  method = 'CASH',
  payment_reference = 'CASH-DEMO-001',
  reference = 'CASH-DEMO-001',
  reference_no = 'CASH-DEMO-001',
  payment_number = 'PAY-DEMO-2026-001',
  receipt_number = 'REC-DEMO-2026-001',
  receipt_generated_at = EXCLUDED.receipt_generated_at,
  status = 'RECORDED',
  payment_status = 'CONFIRMED',
  paid_at = EXCLUDED.paid_at,
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Attendance: today's morning session
-- -----------------------------------------------------------------------------

INSERT INTO attendance_sessions (
  id,
  school_id,
  section_id,
  attendance_date,
  slot,
  status,
  taken_by_user_id,
  submitted_at
)
VALUES (
  'a1920000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1500000-0000-4000-8000-000000000002',
  (CURRENT_TIMESTAMP AT TIME ZONE 'America/Port-au-Prince')::date,
  'MORNING',
  'SUBMITTED',
  '94444444-4444-4444-8444-444444444444',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Port-au-Prince')::date,
  status = 'SUBMITTED',
  taken_by_user_id = EXCLUDED.taken_by_user_id,
  submitted_at = NOW(),
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO attendance_records (
  id,
  attendance_session_id,
  student_id,
  status,
  note_i18n
)
VALUES (
  'a1930000-0000-4000-8000-000000000001',
  'a1920000-0000-4000-8000-000000000001',
  'a1800000-0000-4000-8000-000000000001',
  'PRESENT',
  jsonb_build_object('fr', U&'Pr\00E9sent pour la d\00E9monstration.', 'en', 'Present for the demo.')
)
ON CONFLICT (id) DO UPDATE SET
  status = 'PRESENT',
  note_i18n = EXCLUDED.note_i18n,
  deleted_at = NULL,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Gradebook: one Mathematics quiz and one score
-- -----------------------------------------------------------------------------

INSERT INTO gradebook_assessments (
  id,
  school_id,
  section_id,
  subject_id,
  subject_name,
  title,
  assessment_type,
  assessment_date,
  max_points,
  weight_percent,
  notes,
  created_by_user_id
)
VALUES (
  'a1940000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1500000-0000-4000-8000-000000000002',
  'a1600000-0000-4000-8000-000000000001',
  U&'Math\00E9matiques',
  'Quiz 1',
  'QUIZ',
  '2026-06-20',
  20,
  100,
  U&'Quiz de d\00E9monstration.',
  '94444444-4444-4444-8444-444444444444'
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  subject_name = EXCLUDED.subject_name,
  title = 'Quiz 1',
  assessment_type = 'QUIZ',
  assessment_date = EXCLUDED.assessment_date,
  max_points = 20,
  weight_percent = 100,
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO gradebook_scores (
  id,
  school_id,
  assessment_id,
  student_id,
  score,
  note
)
VALUES (
  'a1950000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1940000-0000-4000-8000-000000000001',
  'a1800000-0000-4000-8000-000000000001',
  15,
  U&'Bon travail.'
)
ON CONFLICT (id) DO UPDATE SET
  score = 15,
  note = EXCLUDED.note,
  deleted_at = NULL,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Payroll: one paid item with a printable payslip
-- -----------------------------------------------------------------------------

INSERT INTO payroll_staff_profiles (
  id,
  school_id,
  staff_code,
  full_name,
  job_title,
  position_title,
  department,
  employment_type,
  pay_frequency,
  base_salary,
  currency_code,
  payroll_active,
  notes,
  created_by_user_id
)
VALUES (
  'a1a00000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'EMP-DEMO-001',
  U&'Mme Nad\00E8ge Pierre',
  'Enseignante',
  'Enseignante',
  'Primaire',
  'TEACHER',
  'MONTHLY',
  450,
  'USD',
  TRUE,
  U&'Profil de paie de d\00E9monstration.',
  '94444444-4444-4444-8444-444444444444'
)
ON CONFLICT (id) DO UPDATE SET
  staff_code = EXCLUDED.staff_code,
  full_name = EXCLUDED.full_name,
  job_title = EXCLUDED.job_title,
  position_title = EXCLUDED.position_title,
  department = EXCLUDED.department,
  employment_type = EXCLUDED.employment_type,
  pay_frequency = 'MONTHLY',
  base_salary = 450,
  currency_code = 'USD',
  payroll_active = TRUE,
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO payroll_runs (
  id,
  school_id,
  payroll_number,
  period_label,
  period_start,
  period_end,
  payroll_status,
  currency_code,
  total_gross,
  total_allowances,
  total_deductions,
  total_net,
  notes,
  created_by_user_id
)
VALUES (
  'a1a10000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'PAYROLL-DEMO-2026-001',
  'Juin 2026 Payroll',
  '2026-06-01',
  '2026-06-30',
  'PAID',
  'USD',
  450,
  0,
  0,
  450,
  U&'Paie de d\00E9monstration ALMAC.',
  '94444444-4444-4444-8444-444444444444'
)
ON CONFLICT (id) DO UPDATE SET
  period_label = EXCLUDED.period_label,
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  payroll_status = 'PAID',
  currency_code = 'USD',
  total_gross = 450,
  total_allowances = 0,
  total_deductions = 0,
  total_net = 450,
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO payroll_run_items (
  id,
  school_id,
  payroll_run_id,
  payroll_staff_profile_id,
  gross_salary,
  allowances,
  deductions,
  net_salary,
  payment_status,
  paid_at,
  payment_method,
  payment_reference,
  notes
)
VALUES (
  'a1a20000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1a10000-0000-4000-8000-000000000001',
  'a1a00000-0000-4000-8000-000000000001',
  450,
  0,
  0,
  450,
  'PAID',
  '2026-06-30 09:00:00-04',
  'CASH',
  'PAY-DEMO-001',
  U&'Salaire pay\00E9 pour la d\00E9monstration.'
)
ON CONFLICT (id) DO UPDATE SET
  gross_salary = 450,
  allowances = 0,
  deductions = 0,
  net_salary = 450,
  payment_status = 'PAID',
  paid_at = EXCLUDED.paid_at,
  payment_method = 'CASH',
  payment_reference = 'PAY-DEMO-001',
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  updated_at = NOW();

COMMIT;

-- Demo anchors for quick verification:
-- school_id:  a1000000-0000-4000-8000-000000000001
-- student_id: a1800000-0000-4000-8000-000000000001
-- invoice_id: a1900000-0000-4000-8000-000000000001
-- payment_id: a1910000-0000-4000-8000-000000000001
-- payslip:    a1a20000-0000-4000-8000-000000000001
