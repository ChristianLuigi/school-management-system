DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM (
      'DRAFT',
      'ISSUED',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'VOID'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'PENDING',
      'CONFIRMED',
      'CANCELLED',
      'REFUNDED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'invoice_status'
      AND e.enumlabel = 'PARTIALLY_PAID'
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'PARTIALLY_PAID' AFTER 'ISSUED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status'
      AND e.enumlabel = 'PENDING'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'PENDING' BEFORE 'RECORDED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status'
      AND e.enumlabel = 'CONFIRMED'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'CONFIRMED' AFTER 'PENDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status'
      AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'CANCELLED' AFTER 'CONFIRMED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status'
      AND e.enumlabel = 'REFUNDED'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'REFUNDED' AFTER 'CANCELLED';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID REFERENCES students(id),
  invoice_number TEXT,
  invoice_status invoice_status NOT NULL DEFAULT 'DRAFT',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_status invoice_status NOT NULL DEFAULT 'DRAFT';

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS issue_date DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id);

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE invoices
SET invoice_status = CASE status::text
  WHEN 'PARTIAL' THEN 'PARTIALLY_PAID'::invoice_status
  WHEN 'DRAFT' THEN 'DRAFT'::invoice_status
  WHEN 'ISSUED' THEN 'ISSUED'::invoice_status
  WHEN 'PAID' THEN 'PAID'::invoice_status
  WHEN 'OVERDUE' THEN 'OVERDUE'::invoice_status
  WHEN 'VOID' THEN 'VOID'::invoice_status
  ELSE invoice_status
END
WHERE invoice_status = 'DRAFT'
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'invoices'
      AND column_name = 'status'
  );

UPDATE invoices
SET amount_paid = GREATEST(total_amount - balance_due, 0)
WHERE amount_paid = 0
  AND total_amount > 0;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  invoice_id UUID REFERENCES invoices(id),
  student_id UUID REFERENCES students(id),
  payment_status payment_status NOT NULL DEFAULT 'CONFIRMED',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  method TEXT,
  reference TEXT,
  notes TEXT,
  received_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'CONFIRMED';

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_date DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS method TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS received_by_user_id UUID REFERENCES users(id);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE payments
SET school_id = inv.school_id
FROM invoices inv
WHERE payments.invoice_id = inv.id
  AND payments.school_id IS NULL;

UPDATE payments
SET payment_status = CASE status::text
  WHEN 'REVERSED' THEN 'CANCELLED'::payment_status
  ELSE 'CONFIRMED'::payment_status
END
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'payments'
    AND column_name = 'status'
);

UPDATE payments
SET method = payment_method::text
WHERE method IS NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name = 'payment_method'
  );

UPDATE payments
SET reference = reference_no
WHERE reference IS NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name = 'reference_no'
  );

UPDATE payments
SET received_by_user_id = recorded_by_user_id
WHERE received_by_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name = 'recorded_by_user_id'
  );

CREATE INDEX IF NOT EXISTS idx_invoices_school_status
  ON invoices(school_id, invoice_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_school_due_date
  ON invoices(school_id, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_student
  ON invoices(student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_school_date
  ON payments(school_id, payment_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON payments(invoice_id)
  WHERE deleted_at IS NULL;
