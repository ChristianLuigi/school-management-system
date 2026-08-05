# Staff Management Lifecycle and Workspace

## Purpose

The staff directory is the canonical employment record for school personnel.
A login role answers which module a user may enter; the staff record determines
whether the employee's staff access is currently usable.

The backend deliberately supports staff without login accounts. The
invitation/linking workflow connects an activated account to
the selected existing staff record without creating a duplicate employee.

## Employment lifecycle

Allowed transitions are enforced by PostgreSQL and by the application service:

- `DRAFT` -> `ACTIVE` or `ARCHIVED`
- `ACTIVE` -> `ON_LEAVE`, `SUSPENDED`, or `TERMINATED`
- `ON_LEAVE` -> `ACTIVE`, `SUSPENDED`, or `TERMINATED`
- `SUSPENDED` -> `ACTIVE` or `TERMINATED`
- `TERMINATED` -> `ACTIVE` (controlled rehire) or `ARCHIVED`
- `ARCHIVED` is terminal and read-only

Every transition requires:

- the current `rowVersion`;
- a non-future effective date that does not precede the current status date;
- a new, non-empty reason; and
- an active same-school School Administrator actor.

Status events are append-only. Employment periods and primary-position periods
remain queryable after later changes.

## Access and payroll side effects

Every linked-user lifecycle transition increments `authentication_version` and
revokes active sessions.

Suspension, termination, and archival also:

- disable active payroll profiles;
- suspend active teacher assignments on suspension;
- archive active teacher assignments on termination or archival.

Reactivation and rehire never restore payroll or teaching access automatically.
The response contains `accessReviewRequired: true`, and an administrator must
review those privileges explicitly.

Staff roles (`SCHOOL_ADMIN`, `TEACHER`, and `FINANCE_ADMIN`) are honored only
while the linked staff record is `ACTIVE` or `ON_LEAVE`. A suspended or
terminated employee can retain an unrelated `PARENT` role without recovering
staff access.

An administrator cannot suspend, terminate, or archive their own staff access.
The last active School Administrator is also protected.

## API

All endpoints require a bearer session and active same-school School
Administrator access.

- `GET /staff-management/staff`
- `POST /staff-management/staff`
- `GET /staff-management/staff/:staffId`
- `PATCH /staff-management/staff/:staffId`
- `POST /staff-management/staff/:staffId/invitation`
- `POST /staff-management/staff/:staffId/link-user`
- `DELETE /staff-management/staff/:staffId/user-link`
- `POST /staff-management/staff/:staffId/activate`
- `POST /staff-management/staff/:staffId/leave`
- `POST /staff-management/staff/:staffId/suspend`
- `POST /staff-management/staff/:staffId/reactivate`
- `POST /staff-management/staff/:staffId/terminate`
- `POST /staff-management/staff/:staffId/rehire`
- `POST /staff-management/staff/:staffId/archive`
- `GET /staff-management/staff/:staffId/history`
- `GET /staff-management/staff/:staffId/access`
- `GET /staff-management/staff/:staffId/assignments`
- `GET /staff-management/staff/:staffId/assignment-options`
- `GET /staff-management/staff/:staffId/payroll-summary`
- `GET /staff-management/staff/:staffId/medical`
- `PATCH /staff-management/staff/:staffId/medical`
- `GET /staff-management/options`

List filters include search, category, employment type/status, department,
linked/unlinked account, payroll-profile presence, assignment presence, and
pagination.

The directory and access responses exclude password hashes, session tokens,
authentication versions, reset/invitation tokens, and raw database errors.

## School Administrator workspace

The administrator workspace provides a role-protected `/staff` route with authenticated same-origin
proxy routes under `/api/staff-management`.

The directory supports:

- search and filters for employment status, category, department, and account
  linkage;
- paginated staff cards with employment, payroll, and assignment indicators;
- creation of staff records without requiring a login account; and
- direct navigation to each staff record.

The detail workspace supports:

- identity, contact, employment, position, supervisor, and staff-code updates;
- optimistic concurrency through `rowVersion`;
- effective-dated, reasoned position changes;
- only the lifecycle actions allowed from the current status;
- confirmations for access-affecting actions; and
- separate history, access, academic-assignment, and payroll-summary views.

Browser controls improve operator flow, but all lifecycle and school-scope
rules remain enforced by the API and database.

### Operational workspace

The staff detail page now provides role-aware operational editors:

- invite an unlinked teacher or finance employee and link the activated account
  to that exact staff record;
- resend or revoke the staff-bound pending invitation without exposing its
  token;
- assign a linked teacher to configured sections and subjects for an academic
  year;
- grant only selected finance permissions, with payroll permissions excluded
  unless explicitly selected;
- create or inspect a payroll profile linked to the staff record; and
- maintain a structured postal address on the canonical staff record.

Teacher-assignment and finance-permission changes use the existing
access-management services and revoke the affected user's active sessions.
Invitation activation validates the staff record, school, email, status, and
role before linking it.

The medical panel is deliberately small and confidential. It stores emergency
contact details, allergies or relevant conditions, and accommodation notes in a
separate table. Only an active same-school School Administrator may read or
update it. Medical values are excluded from directory, access, invitation, and
activity-log payloads; activity events record only which fields changed.

## Database objects

Migration `068_staff_employment_lifecycle.sql` adds:

- lifecycle metadata to `school_staff_accounts`;
- `staff_status_events`;
- `staff_employment_periods`;
- `staff_position_assignments`;
- school-scoped staff-code sequences and `next_school_staff_code()`;
- database transition and append-only-history triggers.

Do not edit migration 068 after it has been applied. Add a new migration for
future lifecycle changes.

Migration `069_staff_operational_workspace.sql` adds:

- structured staff address columns;
- invitation-to-staff binding with school-scoped referential integrity;
- protection against multiple pending invitations for one staff record; and
- the separate, versioned `staff_medical_information` table and audit triggers.

Do not edit migration 069 after it has been applied. Its full filename and
checksum are part of migration history.

## Canonical roadmap

S10 adds employee self-service for safe profile review, standard-document
downloads, leave submission, and pending-request withdrawal. Its security
boundary is documented in `STAFF_SELF_SERVICE.md`.

The authoritative S5-S10 mapping, completion state, remaining gaps, and
recommended implementation order are documented in
`STAFF_ROADMAP_RECONCILIATION.md`.
