CREATE TABLE IF NOT EXISTS school_finance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  default_currency_code TEXT NOT NULL DEFAULT 'USD',
  default_invoice_due_days INT NOT NULL DEFAULT 30,
  enabled_payment_methods JSONB NOT NULL DEFAULT '["CASH","BANK_TRANSFER","CHECK","MOBILE_MONEY","CARD","OTHER"]'::jsonb,
  finance_contact_name TEXT,
  finance_contact_email TEXT,
  finance_contact_phone TEXT,
  invoice_footer_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt_footer_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_finance_settings_school_active
  ON school_finance_settings(school_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_finance_settings_school
  ON school_finance_settings(school_id)
  WHERE deleted_at IS NULL;
