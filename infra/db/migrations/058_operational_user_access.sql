BEGIN;
ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS guardian_id UUID REFERENCES guardians(id),
  ADD COLUMN IF NOT EXISTS staff_code TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS initial_permission_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE IF NOT EXISTS school_staff_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), school_id UUID NOT NULL REFERENCES schools(id),
  user_id UUID NOT NULL REFERENCES users(id), staff_code TEXT,
  staff_type TEXT NOT NULL CHECK (staff_type IN ('SCHOOL_ADMIN','TEACHER','FINANCE_ADMIN')),
  job_title TEXT, department TEXT,
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (employment_status IN ('ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED','ARCHIVED')),
  created_by_user_id UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_account_user ON school_staff_accounts(school_id,user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_code ON school_staff_accounts(school_id,staff_code) WHERE deleted_at IS NULL AND staff_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS guardian_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), school_id UUID NOT NULL REFERENCES schools(id), user_id UUID NOT NULL REFERENCES users(id),
  guardian_id UUID NOT NULL REFERENCES guardians(id), created_by_user_id UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardian_account_link ON guardian_account_links(school_id,user_id,guardian_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guardian_account_links_user ON guardian_account_links(user_id,school_id) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS teacher_academic_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), school_id UUID NOT NULL REFERENCES schools(id), teacher_user_id UUID NOT NULL REFERENCES users(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id), section_id UUID NOT NULL REFERENCES sections(id), subject_id UUID NOT NULL REFERENCES school_subjects(id),
  assignment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (assignment_status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
  assigned_by_user_id UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_academic_assignment ON teacher_academic_assignments(school_id,teacher_user_id,academic_year_id,section_id,subject_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_assignment_scope ON teacher_academic_assignments(teacher_user_id,academic_year_id,section_id) WHERE deleted_at IS NULL AND assignment_status='ACTIVE';
CREATE TABLE IF NOT EXISTS school_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), school_id UUID NOT NULL REFERENCES schools(id), user_id UUID NOT NULL REFERENCES users(id),
  permission_code TEXT NOT NULL CHECK (permission_code IN ('FINANCE_DASHBOARD_VIEW','FINANCE_INVOICES_VIEW','FINANCE_INVOICES_CREATE','FINANCE_INVOICES_EDIT','FINANCE_PAYMENTS_VIEW','FINANCE_PAYMENTS_RECORD','FINANCE_RECEIPTS_PRINT','FINANCE_REPORTS_VIEW','PAYROLL_VIEW','PAYROLL_MANAGE')),
  granted_by_user_id UUID REFERENCES users(id), granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_user_permission ON school_user_permissions(school_id,user_id,permission_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_school_user_permissions_lookup ON school_user_permissions(user_id,school_id,permission_code) WHERE deleted_at IS NULL;
COMMIT;