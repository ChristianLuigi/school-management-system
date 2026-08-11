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
| S7 payroll integration | Pilot-ready for salaried staff | Offline staff can be enrolled and paid from immutable effective-dated compensation; hourly/daily work-unit calculation remains deliberately disabled. |
| S8 documents/compliance | Pilot-ready | Private document storage, validation, school scope, revocation, expiry monitoring, and download authorization auditing are enforced. |
| S9 reports/bulk operations | Partial | Operational reports, safe CSV exports, and a read-only staff import validation preview exist; reviewed import execution and safe bulk mutations remain deferred. |
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

Implemented:

- payroll profiles and run items use the canonical staff account and no longer
  require a linked user or active application membership;
- active and on-leave offline staff appear in payroll enrollment options;
- `payroll_compensation_versions` stores immutable, effective-dated salary,
  currency, pay frequency, standard allowances/deductions, reason, and approver;
- initial payroll enrollment creates the first compensation version;
- only an active School Administrator can create or change compensation;
- a payroll run selects the latest version effective on its period start;
- standard allowances and deductions are copied into the draft run and totals;
- every run item references the exact compensation version used;
- historical run snapshots remain unchanged after later compensation changes;
- legacy payroll profiles are reconciled to offline staff accounts, and their
  historical run items gain canonical references without changing money;
- School Administrators can review compensation history and schedule the next
  immutable salary version from the payroll profile screen;
- termination and hire dates determine whether staff belong in a pay period; and
- duplicate effective dates and mutation of compensation history are rejected.

Controlled-pilot boundary:

- the automated workflow currently supports salaried compensation only;
- hourly and daily types are stored for forward compatibility but rejected by
  the service until approved hours/days and rate calculations exist.

S7 meets the original exit criterion for salaried pilot staff: employees without
login accounts can be enrolled and paid correctly from staff-owned compensation
history. Hourly/daily payroll is explicitly out of pilot scope.

## S8 - Documents and compliance

Implemented:

- private storage with generated paths;
- PDF, JPEG, PNG, and WEBP allowlists;
- file-signature validation and a 10 MB limit;
- traversal prevention and no public storage URL;
- active same-school administrator authorization;
- standard and restricted classifications;
- versioned revocation without physical audit destruction;
- activity events for add, revoke, and authorized downloads without storage keys or filenames;
- optional issue/expiration dates; and
- expired/expiring credential reporting.

Remaining:

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
- current headcount by normalized department;
- teacher assignment coverage with academic year, section, subject, and login readiness;
- current payroll-eligibility detail without compensation amounts;
- staff-access reconciliation covering account, membership, and role alignment
  with active-session visibility while treating offline staff as supported;
- credential and leave queues; and
- safe operational and filtered-directory CSV exports that exclude salary,
  medical information, leave reasons, tokens, storage keys, internal IDs, and
  row versions while neutralizing spreadsheet formulas; and
- CSV staff import upload, strict UTF-8 parsing, a downloadable template, and
  a server-authorized read-only validation preview covering formats,
  duplicate file values, and conflicts with existing school records. The
  preview is limited to 500 rows and never creates staff records.

Missing:

- reviewed execution of a validated staff import preview;
- reviewed safe bulk actions; and
- specialized approval workflows before any high-risk bulk change.

S9 remains open.

## S10 - Employee self-service

S10 is an additional batch, not a replacement for payroll S7. Its scope and
security rules are documented in `STAFF_SELF_SERVICE.md`.

## Recommended implementation order

1. Keep hourly/daily payroll out of scope until approved work-unit data exists.
2. Treat optional document malware scanning as deployment work.
3. Complete S9 reports before introducing any bulk mutation.
4. Run database-backed integration tests and UAT after each batch before
   declaring its exit criterion closed.
