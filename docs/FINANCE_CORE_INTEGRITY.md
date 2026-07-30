# Finance Core Integrity

Batch F1 establishes `/finance/*` as the only supported staff finance API.
The former fee-plan, invoice-generation, direct-payment, student-discount, and
overdue controllers are intentionally not registered. The parent finance
summary remains available through its scoped parent controller.

## Ledger rules

- `invoice_status` and `payment_status` are canonical. Compatibility columns
  are synchronized by database triggers.
- Confirmed payments are the source of truth for invoice `amount_paid` and
  `balance_due`.
- An invoice balance cannot be negative and a payment cannot exceed the locked
  invoice balance.
- Invoice and payment currency codes are stored independently and must match.
- Reports return one monetary total per currency. HTG and USD are never added
  together.
- Non-cash payments require a reference and every payment method must be
  enabled in the school's finance settings.
- Creating an invoice or recording a payment requires an `Idempotency-Key`
  header. Repeating the same key and payload returns the original result;
  reusing the key for a changed payload is rejected.

## Permission boundaries

School administrators retain full school finance authority. Finance
administrators require explicit permission codes. High-risk permissions are
not part of the default invitation grant:

- `FINANCE_INVOICES_VOID`
- `FINANCE_PAYMENTS_REVERSE`
- `FINANCE_REPORTS_EXPORT`
- `FINANCE_SETTINGS_MANAGE`
- `PAYROLL_VIEW`
- `PAYROLL_MANAGE`

The UI consumes server-derived capabilities, but the API remains the
authoritative enforcement layer. Teacher student-profile responses omit
finance data and controls.

## Migration 060

`060_finance_core_integrity.sql`:

1. Adds the finance idempotency ledger.
2. Backfills and requires payment currency.
3. Refuses to continue if historical confirmed payments exceed an invoice.
4. Rebuilds invoice balances from confirmed payments.
5. Synchronizes compatibility status columns.
6. Adds amount, balance, currency, and non-cash reference constraints.
7. Expands the finance permission allow-list.

Before upgrading an existing installation, create and verify a backup. If its
migration history is empty but its schema already contains migrations 001–059,
rehearse the explicit baseline procedure against a restored copy first:

```powershell
$env:DATABASE_URL = "<restored-test-database-url>"
pnpm --dir apps/api db:migrate:baseline -- --through 059_disable_legacy_seed_super_admin.sql --confirm BASELINE_EXISTING_SCHEMA
pnpm --dir apps/api db:migrate
pnpm --dir apps/api db:migrate:verify
```

Never baseline a partially built schema or use baseline to conceal a failed
migration. On a normally tracked installation, run only `db:migrate` followed
by `db:migrate:verify`.

## Operator checks

After migration, all of the following must be zero:

```sql
SELECT COUNT(*)
FROM invoices
WHERE deleted_at IS NULL
  AND status::text <> invoice_status::text;

SELECT COUNT(*)
FROM payments
WHERE deleted_at IS NULL
  AND status::text <> payment_status::text;

SELECT COUNT(*)
FROM payments
WHERE currency_code IS NULL;
```

The integration suite covers retry replay, conflicting idempotency reuse,
concurrent overpayment attempts, payment-method enforcement, status
synchronization, retired routes, finance privacy on teacher profiles, and
multi-currency reporting.
