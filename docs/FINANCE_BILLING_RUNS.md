# Finance billing plans and runs (F4)

F4 rebuilds fee-plan billing on top of the canonical F1 invoice ledger. The
legacy `/fee-plans` and `/invoices/generate` controllers remain disabled.
Controlled billing is available at `/finance/billing`.

## Operating workflow

1. Create a plan for one academic year.
2. Optionally scope the plan to one grade; an unscoped plan covers every active
   enrollment in the year.
3. Choose a stable period code, such as `2026-09`, `2026-T1`, or
   `REGISTRATION-2026`.
4. Preview the run.
5. Review eligible students, duplicate warnings, dates, status, currency, and
   total exposure.
6. Select the students to charge and confirm once.
7. Review the immutable run result and open generated invoices as needed.

## Duplicate-charge boundary

The billing identity is:

```text
school + student + fee plan + academic year + billing period code
```

The API acquires a PostgreSQL advisory transaction lock for that identity
scope. PostgreSQL also has a partial unique index on generated run items.
Concurrent requests therefore cannot charge a student twice.

An idempotency key is required when a run is generated:

- retrying the same key and request returns the original result;
- reusing the key for different input is rejected;
- using a new key for the same period creates a catch-up run, but previously
  charged students are recorded as `SKIPPED_DUPLICATE`.

## Plan lifecycle

Plans are never hard-deleted by this workflow. Archiving prevents future
previews and runs while preserving invoices, run history, and the plan
snapshot stored on each completed run.

Invoice amounts, currency, names, academic scope, and frequency are copied into
the run snapshot. Historical run evidence therefore does not depend on later
plan changes.

## Authorization

Viewing billing plans and run history requires `FINANCE_INVOICES_VIEW`.
Creating or archiving plans, previewing runs, and generating invoices requires
the explicit `FINANCE_BILLING_MANAGE` permission.

`FINANCE_BILLING_MANAGE` is not granted by default to Finance Admin users.
School Admins and ALMAC Super Admins retain their privileged authority.

## Safety limits

- Only active students with an active enrollment in the plan scope qualify.
- Cross-school years, grades, plans, and students are rejected.
- A run is limited to 500 students.
- Due dates cannot precede issue dates.
- Plan amount must be positive and currency must be a three-letter code.
- The complete run is transactional: invoices and run evidence commit
  together or all changes roll back.

## Validation checklist

- Preview correctly separates ready and previously billed students.
- Repeating the same idempotency key returns the original run.
- Conflicting idempotency reuse returns HTTP 409.
- Two concurrent runs generate only one charge per student and period.
- A catch-up run skips prior charges and invoices only newly eligible students.
- An archived plan cannot be previewed or generated.
- A student from another school cannot be selected.
- Generated invoice totals and currencies match the plan snapshot.
- Run detail links every generated or skipped student to the relevant invoice.
