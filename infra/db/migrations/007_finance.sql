-- =========================================================
-- FINANCE
-- =========================================================
CREATE TABLE fee_plans (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
name_i18n JSONB NOT NULL,
fee_type fee_type NOT NULL,
billing_frequency billing_frequency NOT NULL,
grade_level_id UUID NULL REFERENCES grade_levels(id),
default_amount NUMERIC(12,2) NOT NULL CHECK (default_amount >= 0),
currency_code VARCHAR(3) NOT NULL,
is_active BOOLEAN NOT NULL DEFAULT TRUE,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL

);

CREATE TRIGGER trg_fee_plans_updated_at
BEFORE UPDATE ON fee_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE student_discounts (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id UUID NOT NULL REFERENCES students(id),
name_i18n JSONB NOT NULL,
discount_type discount_type NOT NULL,
value NUMERIC(12,2) NOT NULL CHECK (value >= 0),
scope discount_scope NOT NULL,
start_date DATE NOT NULL,
end_date DATE NULL,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT chk_student_discount_dates CHECK (end_date IS NULL OR end_date >= start_date)

);

CREATE TRIGGER trg_student_discounts_updated_at
BEFORE UPDATE ON student_discounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoices (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
student_id UUID NOT NULL REFERENCES students(id),
academic_year_id UUID NOT NULL REFERENCES academic_years(id),
grading_period_id UUID NULL REFERENCES grading_periods(id),
invoice_number VARCHAR(50) NOT NULL,
status invoice_status NOT NULL DEFAULT 'DRAFT',
issue_date DATE NOT NULL,
due_date DATE NOT NULL,
currency_code VARCHAR(3) NOT NULL,
subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_invoice_number_per_school UNIQUE (school_id, invoice_number),
CONSTRAINT chk_invoice_dates CHECK (due_date >= issue_date)

);

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoice_lines (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
invoice_id UUID NOT NULL REFERENCES invoices(id),
fee_plan_id UUID NULL REFERENCES fee_plans(id),
label_i18n JSONB NOT NULL,
quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
unit_amount NUMERIC(12,2) NOT NULL CHECK (unit_amount >= 0),
discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL

);

CREATE TRIGGER trg_invoice_lines_updated_at
BEFORE UPDATE ON invoice_lines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payments (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
invoice_id UUID NOT NULL REFERENCES invoices(id),
student_id UUID NOT NULL REFERENCES students(id),
payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
payment_method payment_method NOT NULL,
reference_no VARCHAR(100) NULL,
receipt_number VARCHAR(50) NOT NULL,
recorded_by_user_id UUID NOT NULL REFERENCES users(id),
status payment_status NOT NULL DEFAULT 'RECORDED',

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL

);

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE expenses (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
expense_date DATE NOT NULL,
category_i18n JSONB NOT NULL,
description_i18n JSONB NULL,
amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
recorded_by_user_id UUID NOT NULL REFERENCES users(id),

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL

);

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();