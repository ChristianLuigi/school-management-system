# Staff Self-Service (S10)

## Scope

S10 gives linked school employees a narrow self-service workspace at
`/my-staff-profile`. It is available to active `SCHOOL_ADMIN`, `TEACHER`,
and `FINANCE_ADMIN` members whose account is linked to an active or on-leave
staff record in the selected school.

Employees can:

- review their employment, position, supervisor, contact, and address data;
- list and download their own active standard-confidentiality documents;
- submit leave requests;
- follow the administrative decision; and
- withdraw a still-pending request that they personally submitted.

Employment data remains read-only. Corrections are made by a School
Administrator so lifecycle history and position controls are not bypassed.

## Authorization boundary

Every API operation resolves the staff record from the authenticated user and
requested school. Client-supplied staff or user identifiers are never trusted.

Self-service access requires all of the following:

- the school exists and is not deleted;
- the membership is active;
- the membership has a staff role;
- the linked staff record belongs to the same school; and
- employment status is `ACTIVE` or `ON_LEAVE`.

Suspended or terminated employees, parent-only accounts, unlinked accounts, and
cross-school requests are rejected.

The profile response excludes user IDs, row versions, authentication versions,
medical data, payroll data, and credentials. Document lists exclude storage
keys. Restricted documents are not listed or downloadable. The server resolves
the storage key only after authorizing the document against the employee's own
staff record.

An employee may withdraw only a `SUBMITTED` leave request created through
their own account. Approved leave remains under the administrator workflow.
Row-version checks prevent stale cancellation, and submission/cancellation
events are recorded without copying the private leave reason into platform
activity payloads.

## API

All endpoints require a bearer session:

- `GET /staff-self-service/profile?schoolId=...`
- `GET /staff-self-service/documents?schoolId=...`
- `GET /staff-self-service/documents/:documentId/download?schoolId=...`
- `GET /staff-self-service/leave-requests?schoolId=...`
- `POST /staff-self-service/leave-requests`
- `POST /staff-self-service/leave-requests/:leaveRequestId/cancel`

Authenticated same-origin Next.js proxy routes are available under
`/api/staff-self-service`. Mutating routes enforce the trusted-origin policy.

## Data and migrations

S10 uses the staff, document, and leave objects introduced by migrations 067
through 070. It introduces no new database object and therefore does not alter
an applied migration checksum.

## Verification

The database-backed integration suite covers:

- safe own-profile projection with medical-data exclusion;
- own standard-document listing and download metadata;
- restricted-document denial;
- leave submission, overlap rejection, listing, and pending withdrawal;
- cross-school denial;
- suspended-staff and deleted-school denial; and
- parent-only role denial.

Manual UAT:

1. Log in as a linked teacher and open `/my-staff-profile`.
2. Confirm employment and contact information is read-only.
3. Confirm only the employee's active standard documents appear.
4. Confirm a restricted document is absent and its modified URL returns 404.
5. Submit leave and confirm it appears as pending in both employee and
   administrator workspaces.
6. Withdraw the pending request and confirm the audit state becomes cancelled.
7. Approve another request as an administrator and confirm the employee cannot
   withdraw it from self-service.
8. Change `schoolId`, document ID, and leave ID in browser requests and confirm
   the backend rejects access.
9. Suspend the staff record and confirm self-service access is denied.

## Deferred boundary

Managed leave policies, balances, accrual calculations, document-retention
automation, scheduled credential reminders, and narrower grants for medical or
restricted-document access require a separate policy/governance batch. They
are deliberately not inferred from employment type or exposed through frontend
filtering.
