ALTER TABLE payroll_staff_profiles
ADD COLUMN IF NOT EXISTS staff_code TEXT;

ALTER TABLE payroll_staff_profiles
ADD COLUMN IF NOT EXISTS position_title TEXT;

ALTER TABLE payroll_staff_profiles
ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE payroll_staff_profiles
ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'STAFF';

ALTER TABLE payroll_staff_profiles
ADD COLUMN IF NOT EXISTS pay_frequency TEXT NOT NULL DEFAULT 'MONTHLY';

UPDATE payroll_staff_profiles
SET position_title = job_title
WHERE position_title IS NULL
  AND job_title IS NOT NULL;

ALTER TABLE payroll_run_items
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE payroll_run_items
ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE payroll_run_items
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE payroll_run_items
ADD COLUMN IF NOT EXISTS notes TEXT;
