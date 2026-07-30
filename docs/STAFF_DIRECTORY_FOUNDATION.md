# Staff Directory Foundation

## Purpose

The staff directory is the canonical record of a person's employment
relationship with a school. A staff record may optionally link to a user
account, but a login is not required.

The responsibilities remain separate:

- `school_staff_accounts` stores staff identity and current employment data.
- `users` stores authentication identity and login security.
- `school_memberships` and roles control school application access.
- `teacher_academic_assignments` controls teacher operational scope.
- `payroll_staff_profiles` stores payroll configuration.
- payroll run items retain immutable staff and compensation snapshots.

Migration `067_staff_directory_foundation.sql` does not create guessed links
for legacy payroll profiles and does not modify payroll snapshots.

## Reconciliation command

Set `DATABASE_URL` to the intended database, then run:

```powershell
pnpm db:staff:reconcile
```

For a deployment gate that returns a nonzero exit code when blocking
inconsistencies exist:

```powershell
pnpm db:staff:reconcile:strict
```

The report contains aggregate counts and issue codes only. It does not print
staff names, email addresses, credentials, tokens, or payroll amounts.

### Blocking issue codes

- `STAFF_MISSING_IDENTITY`
- `DUPLICATE_ACTIVE_STAFF_CODES`
- `DUPLICATE_ACTIVE_STAFF_EMAILS`
- `STAFF_ROLE_USERS_WITHOUT_STAFF`
- `TEACHER_ASSIGNMENTS_WITHOUT_STAFF`

### Warning issue codes

- `LINKED_STAFF_WITHOUT_ACTIVE_MEMBERSHIP`
- `PAYROLL_PROFILES_WITHOUT_STAFF`
- `ACTIVE_TEACHERS_WITHOUT_ASSIGNMENTS`

Warnings require operational review but do not cause `--strict` to fail.
An unlinked payroll profile may represent valid legacy history and must not be
attached to a staff record without verified evidence.

## Initial local reconciliation

The pre-migration local review on 2026-07-26 found:

- 5 active staff records
- 0 staff records without linked users
- 0 staff-role users without staff records
- 0 duplicate active staff codes
- 0 teacher assignments without matching staff records
- 3 active legacy payroll profiles without staff links
- 2 active teaching staff without academic assignments

The legacy payroll profiles remain intentionally unchanged, and the two
teaching staff require assignment review. Operators must verify the correct
records before linking payroll profiles or creating academic assignments in a
later controlled workflow.

## Foundation behavior

Migration 067:

- makes `school_staff_accounts.user_id` optional;
- adds canonical staff name, contact, category, employment, supervisor, and
  lifecycle fields;
- backfills existing linked staff identity from `users`;
- normalizes staff codes and email addresses;
- adds same-school supervisor validation;
- adds case-insensitive staff-code and normalized-email uniqueness;
- adds directory lookup indexes;
- adds optimistic `row_version` tracking;
- preserves the legacy role-derived `staff_type` as an optional compatibility
  field.

New unlinked staff records must contain a name or normalized email address.
Future API batches should require first and last name for ordinary staff
creation even though the database retains compatibility for older records.

## Deferred to later staff batches

This foundation intentionally does not implement:

- Staff CRUD endpoints or pages
- Employment status workflows
- Staff invitations linked to an existing staff record
- Effective-dated position or compensation history
- Teacher assignment migration from user IDs to staff IDs
- Payroll eligibility for staff without login accounts
- Staff document storage

Those changes depend on this foundation and should be implemented without
weakening current authorization or rewriting historical payroll data.
