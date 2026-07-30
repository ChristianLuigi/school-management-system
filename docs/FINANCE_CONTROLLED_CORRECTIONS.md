# Finance controlled corrections (F3)

F3 adds approval-controlled payment reversals, refunds, and invoice credit
notes. It does not delete or overwrite original payment records.

## Accounting behavior

- A payment correction always covers the full original payment amount.
- `REVERSAL` means the original record was erroneous. It has no refund
  settlement fields.
- `REFUND` means money was returned. Cash refunds must be processed through the
  processor's own open cashier session in the same currency. Non-cash refunds
  require a transaction reference.
- The original `payments` row remains `CONFIRMED` and undeleted. Read models
  derive `CORRECTION_PENDING`, `CORRECTION_APPROVED`, `REVERSED`, or `REFUNDED`
  from the correction register.
- Completing a reversal or refund recalculates the invoice from confirmed
  payments minus completed payment corrections.
- An applied credit note increases the invoice adjustment (`discount_amount`)
  and reduces both total and balance due, preserving
  `subtotal_amount - discount_amount = total_amount`.
- F3 deliberately does not support partial payment refunds.

## Separation of duties

The requester cannot approve or reject their own payment correction or credit
note. Processing an approved payment correction is a separate step so the
settlement details can be captured after review.

Permissions are explicit and are not part of the default Finance Admin grant:

- `FINANCE_PAYMENTS_REVERSE`: request and process payment corrections.
- `FINANCE_CREDIT_NOTES_CREATE`: request invoice credit notes.
- `FINANCE_CORRECTIONS_APPROVE`: approve or reject either request type.

School Administrators and ALMAC Super Admins retain their existing privileged
access. Every controller still validates the requested `schoolId` through the
authenticated session and finance authorization layer.

## Operator workflow

1. Open the payment receipt or invoice and select the correction action.
2. Enter a reason of at least 10 characters and submit the request.
3. A different authorized user opens **Finance → Corrections and credit
   notes** and approves or rejects the request.
4. For an approved reversal, an authorized processor completes the reversal.
5. For an approved refund:
   - Cash: the processor opens a cashier session for that currency, then records
     the refund.
   - Non-cash: the processor selects the method and enters the external refund
     reference.
6. Reopen the receipt or invoice to confirm its effective status and
   recalculated balance.

## Audit records

`finance_payment_corrections` and `finance_invoice_credit_notes` contain the
request, review, and processing records plus immutable source snapshots.
`finance_correction_events` records lifecycle events. Platform activity logs
also receive request, approval/rejection, and completion events.

Idempotency keys are required for payment-correction and credit-note creation.
Reusing a key with the same request returns the original response; reuse with a
different request is rejected.

## Validation checklist

- Requester cannot approve or reject their own request.
- A rejected request cannot be processed.
- A payment cannot have another active or completed correction.
- A cash refund without the processor's open matching-currency session fails.
- A non-cash refund without a reference fails.
- A credit note cannot exceed the current balance due.
- A draft or void invoice cannot receive a credit note.
- Cross-school payment, invoice, correction, and credit-note IDs are rejected.
- The original payment remains present and confirmed after correction.
- Cash refund totals reduce expected drawer cash.
- Receipt and invoice payment history show the effective correction status.
