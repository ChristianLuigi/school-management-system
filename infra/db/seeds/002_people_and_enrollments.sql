-- =========================================================
-- PEOPLE + ENROLLMENT SEED
-- =========================================================

-- USERS
INSERT INTO users (id, email, password_hash, preferred_locale, status)
VALUES
(
  '77777777-7777-4777-8777-777777777771',
  'director@alphaschool.edu',
  'dev-placeholder-hash',
  'fr',
  'ACTIVE'
),
(
  '77777777-7777-4777-8777-777777777772',
  'teacher.marie@alphaschool.edu',
  'dev-placeholder-hash',
  'fr',
  'ACTIVE'
),
(
  '77777777-7777-4777-8777-777777777773',
  'teacher.john@alphaschool.edu',
  'dev-placeholder-hash',
  'en',
  'ACTIVE'
),
(
  '77777777-7777-4777-8777-777777777774',
  'parent.dupont@example.com',
  'dev-placeholder-hash',
  'fr',
  'ACTIVE'
),
(
  '77777777-7777-4777-8777-777777777775',
  'parent.smith@example.com',
  'dev-placeholder-hash',
  'en',
  'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;

-- SCHOOL USER ROLES
INSERT INTO school_user_roles (id, school_id, user_id, role, is_primary)
VALUES
(
  '78888888-8888-4888-8888-888888888881',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777771',
  'SCHOOL_ADMIN',
  TRUE
),
(
  '78888888-8888-4888-8888-888888888882',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777772',
  'TEACHER',
  TRUE
),
(
  '78888888-8888-4888-8888-888888888883',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777773',
  'TEACHER',
  TRUE
),
(
  '78888888-8888-4888-8888-888888888884',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777774',
  'PARENT',
  TRUE
),
(
  '78888888-8888-4888-8888-888888888885',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777775',
  'PARENT',
  TRUE
)
ON CONFLICT (school_id, user_id, role) DO NOTHING;

-- TEACHERS
INSERT INTO teachers (
  id, school_id, user_id, employee_code, first_name, last_name, phone, email_override, is_active
)
VALUES
(
  '79999999-9999-4999-8999-999999999991',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777772',
  'T-001',
  'Marie',
  'Jean',
  '+50930000001',
  NULL,
  TRUE
),
(
  '79999999-9999-4999-8999-999999999992',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777773',
  'T-002',
  'John',
  'Smith',
  '+50930000002',
  NULL,
  TRUE
)
ON CONFLICT (user_id) DO NOTHING;

-- GUARDIANS
INSERT INTO guardians (
  id, school_id, user_id, first_name, last_name, phone, secondary_phone, email_override, receive_attendance_alerts, receive_finance_alerts
)
VALUES
(
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777774',
  'Claire',
  'Dupont',
  '+50931000001',
  NULL,
  NULL,
  TRUE,
  TRUE
),
(
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777775',
  'David',
  'Smith',
  '+50931000002',
  NULL,
  NULL,
  TRUE,
  TRUE
)
ON CONFLICT (user_id) DO NOTHING;

-- STUDENTS
INSERT INTO students (
  id, school_id, student_number, first_name, last_name, date_of_birth, gender, admission_date, status
)
VALUES
(
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '11111111-1111-4111-8111-111111111111',
  'ST-0001',
  'Lucas',
  'Dupont',
  '2014-05-11',
  'M',
  '2025-09-01',
  'ACTIVE'
),
(
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '11111111-1111-4111-8111-111111111111',
  'ST-0002',
  'Emma',
  'Smith',
  '2014-09-21',
  'F',
  '2025-09-01',
  'ACTIVE'
),
(
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  '11111111-1111-4111-8111-111111111111',
  'ST-0003',
  'Noah',
  'Jean',
  '2013-12-03',
  'M',
  '2025-09-01',
  'ACTIVE'
)
ON CONFLICT (school_id, student_number) DO NOTHING;

-- STUDENT / GUARDIAN LINKS
INSERT INTO student_guardians (
  id, student_id, guardian_id, relationship_type, is_primary, can_pick_up, can_view_finance, can_view_academics
)
VALUES
(
  '7ccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'MOTHER',
  TRUE,
  TRUE,
  TRUE,
  TRUE
),
(
  '7ccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'FATHER',
  TRUE,
  TRUE,
  TRUE,
  TRUE
),
(
  '7ccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'AUNT',
  TRUE,
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (student_id, guardian_id) DO NOTHING;

-- ENROLLMENTS
INSERT INTO enrollments (
  id, student_id, academic_year_id, grade_level_id, section_id, enrollment_status, start_date, end_date
)
VALUES
(
  '7ddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555561',
  '66666666-6666-4666-8666-666666666671',
  'ACTIVE',
  '2025-09-01',
  NULL
),
(
  '7ddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555561',
  '66666666-6666-4666-8666-666666666672',
  'ACTIVE',
  '2025-09-01',
  NULL
),
(
  '7ddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555562',
  '66666666-6666-4666-8666-666666666673',
  'ACTIVE',
  '2025-09-01',
  NULL
)
ON CONFLICT DO NOTHING;