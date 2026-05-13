ALTER TABLE school_finance_settings
ADD COLUMN IF NOT EXISTS default_receipt_print_format TEXT NOT NULL DEFAULT 'THERMAL_80MM';

ALTER TABLE school_finance_settings
ADD COLUMN IF NOT EXISTS default_invoice_print_format TEXT NOT NULL DEFAULT 'A4';

ALTER TABLE school_finance_settings
ADD COLUMN IF NOT EXISTS auto_open_receipt_after_payment BOOLEAN NOT NULL DEFAULT FALSE;
