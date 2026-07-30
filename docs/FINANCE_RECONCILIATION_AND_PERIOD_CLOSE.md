# F5 — Deposit reconciliation and financial period close

F5 connects the daily cashier close to a reviewed bank or cash destination and
adds an explicit accounting-period lock. It does not import bank statements or
replace a general ledger.

## Control model

1. A cashier records payments only inside an open daily cashier session.
2. The cashier session is counted and closed.
3. An authorized finance user selects one or more closed sessions and submits a
   deposit.
4. The expected deposit is calculated from the ledger:
   confirmed cash payments less completed cash refunds. The opening cash float
   is excluded.
5. A different authorized user reconciles or rejects the deposit.
6. A rejected deposit releases its cashier sessions for a corrected
   resubmission.
7. A financial period can close only when its operational blockers are zero.
8. A closed period rejects ledger writes at both the service and database
   layers.

The submitter cannot reconcile or reject their own deposit. This separation of
duties is enforced in PostgreSQL and the API, not only in the interface.

## Permissions

- `FINANCE_RECONCILIATION_MANAGE` permits bank-destination administration,
  deposit submission, and deposit review.
- `FINANCE_PERIOD_CLOSE` permits period creation, close, and controlled reopen.
- School Administrators and ALMAC Super Admins retain their existing
  administrative bypass.

Neither permission is in the default Finance Admin permission bundle. Grant it
deliberately from user management.

## Bank destinations

The system stores an operator-defined code, display name, currency, optional
institution name, and optional **masked** reference. Never enter a full account
number, online-banking credential, PIN, API token, or card number.

A destination cannot be archived while a deposit assigned to it is awaiting
review. Historical deposits remain attached to archived destinations.

## Deposit lifecycle

`PENDING_REVIEW → RECONCILED`

or

`PENDING_REVIEW → REJECTED`

Deposit submission requires an `Idempotency-Key` and is serialized in the
database. A cashier session can belong to only one active deposit. Rejection
releases the link; reconciliation preserves it permanently.

A variance is allowed because it may represent a real shortage, overage, fee,
or data-entry problem, but it is always visible and audited. The reviewer must
explain acceptance or rejection in a note of at least ten characters.

## Period close gates

The close operation refuses to proceed while any of the following exists in
the period:

- An open cashier session
- A deposit awaiting review
- A payment correction awaiting review or processing
- A credit note awaiting review
- A closed cashier session with positive net cash collections that is not
  attached to a reconciled deposit

After close, these dated writes are blocked:

- Invoice creation, issue, or void
- Payment recording
- Cashier-session opening
- Billing-run generation
- Deposit submission
- Payment-correction request or processing
- Credit-note request or application

API checks return a safe conflict response. PostgreSQL triggers protect direct
or concurrent writes for invoice, payment, cashier-session, billing-run, and
deposit dates.

## Reopening

Reopening requires `FINANCE_PERIOD_CLOSE` and a reason of at least ten
characters. The action is recorded in the reconciliation event log and platform
activity log. Reopen is intended for exceptional, documented corrections. Close
the period again after the correction and review the resulting activity.

## Operator procedure

1. Close every cashier session for the day.
2. Open `/finance/reconciliation`.
3. Configure a masked bank destination if none exists.
4. Select the destination and eligible cashier sessions.
5. Compare the calculated expected amount with the deposit slip.
6. Enter the actual deposited amount, reference, date, and evidence note.
7. Submit the deposit.
8. Have a different authorized user review the slip and ledger calculation.
9. Resolve every variance and pending correction.
10. Create or select the period, enter a close reason, and run close.
11. Investigate any blocker returned by the close operation.
12. Retain the deposit evidence according to the school’s record policy.

## Audit queries

Deposit history:

```sql
SELECT
  deposit.deposit_date,
  deposit.deposit_reference,
  deposit.expected_amount,
  deposit.deposited_amount,
  deposit.variance_amount,
  deposit.reconciliation_status,
  deposit.requested_at,
  deposit.reviewed_at
FROM finance_deposits deposit
WHERE deposit.school_id = :school_id
ORDER BY deposit.deposit_date DESC, deposit.created_at DESC;
```

Period history:

```sql
SELECT
  period_code,
  start_date,
  end_date,
  period_status,
  closed_at,
  reopen_count,
  reopened_at
FROM finance_accounting_periods
WHERE school_id = :school_id
  AND deleted_at IS NULL
ORDER BY start_date DESC;
```

## Explicit non-goals

F5 does not include bank API synchronization, automated statement matching,
general-ledger journals, fiscal tax filing, multi-entity consolidation, or
foreign-exchange gain/loss accounting. Those require a separate reviewed
accounting design.
