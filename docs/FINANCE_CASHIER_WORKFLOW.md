# Finance Cashier Workflow

Batch F2 adds a single guided collection path at `/finance/cashier`. It builds
on the F1 canonical invoice/payment ledger and does not introduce refunds,
reversals, fee-plan billing, or general-ledger behavior.

## Daily operating flow

1. Search for a student by name or school code.
2. Select an issued invoice with an outstanding balance.
3. Open the cashier session for the invoice currency and school business date.
4. Enter the payment amount, method, reference, and optional note.
5. Review the student, invoice, currency, amount, method, and resulting balance.
6. Confirm the payment once.
7. Print the numbered receipt or continue to the next student.
8. At the end of the shift, count physical cash and close the session.

The school timezone determines the business date. A school staff member working
abroad therefore posts into the school’s day, not the browser computer’s local
date.

## Cashier sessions

Cashier sessions are unique by school, cashier, business date, and currency.
HTG and USD use separate drawers/sessions and are never reconciled together.

Expected cash is:

```text
opening cash + confirmed CASH payments
```

Bank transfers, checks, mobile money, cards, and other enabled methods appear
in the session’s collection summary but do not increase expected physical cash.
Closing records the expected cash, counted cash, and variance as an immutable
event snapshot.

A cashier can close their own session. A closed session cannot accept another
payment. Reopening requires a School Admin, Super Admin, or a Finance Admin with
`FINANCE_CASHIER_SESSIONS_SUPERVISE`; the supervisor must provide an audited
reason.

## Payment boundary

Every F2 payment must include `cashierSessionId`. The API and PostgreSQL both
verify that the session:

- belongs to the requested school;
- belongs to the authenticated actor;
- is open;
- uses the invoice/payment currency; and
- uses the same school business date as the payment.

The F1 idempotency and invoice-row locking rules still apply. A retry with the
same key and payload returns the original payment, while a changed payload is
rejected.

## Receipt printing

Receipt numbers are assigned when the payment is posted. Printing is a separate
audited action:

- The first print is `INITIAL`.
- Every later print is `REPRINT`.
- A reprint requires a reason.
- The audit record stores the payment, session, authenticated actor, print
  format, reason, and timestamp.

Viewing a receipt does not count as printing. The print controls explicitly
record the event before opening the browser print dialog.

## Supervisor checks

Before approving a closed-session reopen:

1. Confirm the cashier and currency.
2. Review expected cash, counted cash, and variance.
3. Confirm why the original close is no longer valid.
4. Enter a specific reason; do not use generic text such as “fix”.
5. After the correction, require the cashier to close and reconcile again.

## Connected controls

Controlled reversals, refunds, and credit notes are delivered in F3. Deposit
reconciliation and financial period close are delivered in F5. See
FINANCE_CONTROLLED_CORRECTIONS.md and
FINANCE_RECONCILIATION_AND_PERIOD_CLOSE.md. Confirmed financial records must
never be edited or deleted directly.
