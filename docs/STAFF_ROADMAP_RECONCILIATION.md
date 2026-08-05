# Canonical Staff Roadmap Reconciliation

## Purpose

This document reconciles the original staff-management roadmap with the code
currently in the repository. The canonical batch meanings are:

- S5: staff account invitation, linking, and unlinking;
- S6: staff-canonical academic assignments;
- S7: staff-canonical payroll and compensation history;
- S8: documents and compliance;
- S9: reporting and safe bulk operations; and
- S10: employee self-service.

Earlier implementation notes used S6 and S7 for different slices. Those labels
are superseded by this mapping. Migration filenames are immutable and are not
renamed to match product batch numbers.

## Completion matrix

| Batch | Status | Exit criterion |
| --- | --- | --- |
| S5 account lifecycle | Implemented | Staff can be created before login access, invited or linked later, and safely unlinked with audit and session protections. |
| S6 academic assignments | Implemented | Teaching responsibility is attached to the staff record; application authorization resolves the active linked user. |
| S7 payroll integration | Partial | Runs and profiles reference staff records and snapshot payroll values, but offline staff cannot yet be paid and effective-dated compensation versions are missing. |
| S8 documents/compliance | Substantially complete | Pilot document storage, validation, school scope, revocation, and expiry monitoring exist; download auditing and optional malware scanning remain. |
| S9 reports/bulk operations | Partial | An operational report and safe CSV export exist; import preview, directory export, complete reports, and reviewed bulk operations do not. |
| S10 employee self-service | Implemented | Active linked employees can safely review their own record/documents and submit or withdraw pending leave. |

## S5 - Account invitation, linking, and unlinking

Implemented:

- staff records may exist with `user_id IS NULL`;
- the staff workspace can send an invitation containing `staffAccountId`;
- invitation creation validates school, email, employment status, and existing
  linkage;
- activation links the new or existing user to the designated staff record;
- duplicate same-school staff links are rejected; and
- activation creates the membership and role in the same transaction.

The browser flow now uses the dedicated staff endpoint, and all canonical
operations exist:

- `POST /staff-management/staff/:staffId/invitation`;
- `POST /staff-management/staff/:staffId/link-user`; and
- `DELETE /staff-management/staff/:staffId/user-link`.

Unlinking is transactional. It rejects self/final-administrator removal,
active teaching assignments, active payroll profiles, mismatched school
scope, stale row versions, and ambiguous roles. It removes only the current
staff role, preserves unrelated roles such as `PARENT`, revokes every active
session, increments the authentication version, and retains historical user
ownership. Link and unlink events are append-only and audited.

S5 meets its exit criterion: administrators can create employment records
without accounts and grant or remove interactive access later.

## S6 - Academic assignment integration

Implemented:

- migration `074_teacher_staff_canonical_assignments.sql` adds and backfills
  mandatory `teacher_staff_account_id`;
- `teacher_user_id` remains nullable as a compatibility and historical
  attribution field;
- the canonical assignment endpoint accepts `staffAccountId`, while the
  user-based endpoint remains available for compatibility;
- active teaching staff can receive assignments before a login account exists;
- the staff workspace manages assignments directly by staff identity;
- assignment management validates same-school academic years, sections, and
  subjects;
- assignment changes revoke the linked user's active sessions;
- staff suspension/termination archives or suspends active assignments at both
  the service and database layers;
- runtime attendance and gradebook authorization resolves the assignment's
  active staff record, linked user, active membership, and Teacher role; and
- a login account remains mandatory to enter teacher-facing modules.

Compatibility behavior:

- legacy user-based writes resolve the active teaching staff record first;
- linking an account synchronizes the legacy user reference;
- historical ownership survives account unlinking; and
- the staff workspace can manage assignments for a linked teacher.

S6 meets its exit criterion: teaching responsibilities are attached to
employment while interactive authorization remains attached to users.

## S7 - Payroll integration and compensation history

Implemented payroll hardening includes:

- payroll profiles linked by `school_staff_account_id`;
- payroll run items linked by `staff_account_id`;
- duplicate-period prevention;
- one currency per run;
- immutable employee and salary snapshots;
- draft, reviewed, approved, processing, paid, and closed states;
- School Administrator approval and preparer/approver separation;
- item allowances, deductions, corrections, payment reversals, closed-run
  locking, summaries, payslips, and payment registers.

Remaining canonical gaps:

- payroll option/profile creation joins `users` and active memberships, so a
  staff record without a login cannot be enrolled or paid;
- `payroll_compensation_versions` or an equivalent effective-dated history
  does not exist;
- `salary_effective_from` exists but is not part of the active profile
  creation workflow;
- pay frequency is hardcoded to monthly in profile creation;
- standard profile-level allowances and deductions are not versioned; and
- there is no privileged, audited compensation-change workflow selecting the
  version effective for a pay period.

The immutable run snapshot is strong, but it is not a substitute for
effective-dated compensation history. S7 remains open.

## S8 - Documents and compliance

Implemented:

- private storage with generated paths;
- PDF, JPEG, PNG, and WEBP allowlists;
- file-signature validation and a 10 MB limit;
- traversal prevention and no public storage URL;
- active same-school administrator authorization;
- standard and restricted classifications;
- versioned revocation without physical audit destruction;
- activity events for add and revoke;
- optional issue/expiration dates; and
- expired/expiring credential reporting.

Remaining:

- record a document-level audit event for successful download/access;
- add malware scanning when deployment infrastructure supports it; and
- introduce narrower restricted-document permissions only after grant
  governance is defined.

S8 is suitable for controlled-pilot use under the current administrator-only
access policy.

## S9 - Reporting and bulk operations

Implemented:

- operational totals for headcount, unlinked accounts, missing payroll
  profiles, teachers without assignments, credential expiry, and pending leave;
- employment-status and staff-category breakdowns;
- credential and leave queues; and
- a safe CSV export that excludes salary, medical information, leave reasons,
  tokens, and storage keys.

Missing:

- CSV staff import with preview and validation report;
- filtered staff-directory export;
- headcount by department;
- detailed teacher assignment coverage;
- a complete payroll-eligibility report;
- detailed staff-access reconciliation;
- reviewed safe bulk actions; and
- specialized approval workflows before any high-risk bulk change.

S9 remains open.

## S10 - Employee self-service

S10 is an additional batch, not a replacement for payroll S7. Its scope and
security rules are documented in `STAFF_SELF_SERVICE.md`.

## Recommended implementation order

1. Add effective-dated compensation versions and remove login dependence from
   payroll enrollment under S7.
2. Add S8 download audit events; treat malware scanning as deployment work.
3. Complete S9 reports before introducing any bulk mutation.
4. Run database-backed integration tests and UAT after each batch before
   declaring its exit criterion closed.
