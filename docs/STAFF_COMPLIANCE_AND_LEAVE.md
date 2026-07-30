# Staff Compliance, Credentials, and Leave (S6)

## Scope

S6 adds four operational capabilities to the School Administrator staff
workspace:

- private staff documents;
- credential-expiry monitoring;
- auditable leave requests; and
- a school-scoped operational staff report with CSV export.

Medical information remains in its separate S5 table and never appears in S6
documents, reports, exports, or activity payloads.

## Private document storage

Staff documents are uploaded through the authenticated Next.js route
`/api/uploads/staff-documents`. The route:

- requires a trusted origin for uploads;
- verifies an active same-school School Administrator session before writing;
- accepts only PDF, JPG, PNG, and WEBP files;
- checks the file signature rather than trusting the extension;
- enforces a 10 MB maximum;
- generates the storage name instead of using the submitted filename;
- prevents traversal outside `UPLOAD_STORAGE_ROOT/staff-documents`; and
- removes the new file if API metadata registration fails.

Downloads re-authorize the user, resolve the storage key server-side, reject
revoked records, use `nosniff`, and disable caching. Storage keys are never
returned by normal document-list endpoints or rendered in the browser.

Document types are identity, contract, certification, license, background
check, work permit, and other. Documents may be standard or restricted. In S6,
both classifications require active School Administrator access; the
classification is retained so a narrower restricted-document permission can be
introduced later without migrating the data.

Revocation is version-checked and retains the private file for audit and
retention purposes. It does not physically erase the file.

## Credential monitoring

Any active document with an expiry date is treated as a credential:

- `EXPIRED`: expiry date precedes today;
- `EXPIRING_SOON`: expiry is within the configured report window;
- `CURRENT`: expiry is beyond the report window; and
- `NOT_APPLICABLE`: no expiry date.

The operational report supports 30, 60, 90, and 180-day windows. The default is
60 days.

## Leave workflow

School Administrators record leave on behalf of active staff.

The state machine is:

```text
SUBMITTED -> APPROVED -> CANCELLED
         \-> REJECTED
         \-> CANCELLED
```

Rules are enforced by the API and PostgreSQL:

- only active or already-on-leave staff may receive a request;
- end date cannot precede start date;
- requested days cannot exceed the selected calendar period;
- submitted or approved requests cannot overlap;
- rejection requires a note;
- every mutation requires the current `rowVersion`;
- when more than one active School Administrator exists, the administrator who
  submitted the request cannot approve it; and
- leave events are append-only.

Approving a future leave request does not automatically change employment
status. The administrator uses the effective-dated employment lifecycle action
when the leave actually starts. This avoids silently placing a staff member on
leave early and keeps the official employment history explicit.

## Operational report

`/staff/reports` shows:

- total staff;
- accounts not yet linked;
- missing payroll profiles;
- teachers without active academic assignments;
- expired and expiring credentials;
- pending leave requests;
- employment-status and staff-category breakdowns;
- credential alerts; and
- submitted or upcoming approved leave.

The CSV export is generated from this safe report DTO in the browser. It does
not include addresses, medical information, leave reasons, document storage
keys, salaries, tokens, or authentication fields.

## API

All endpoints require an active same-school School Administrator:

- `GET /staff-management/staff/:staffId/documents`
- `POST /staff-management/staff/:staffId/documents`
- `GET /staff-management/staff/:staffId/documents/:documentId/download`
- `POST /staff-management/staff/:staffId/documents/:documentId/revoke`
- `GET /staff-management/staff/:staffId/leave-requests`
- `POST /staff-management/staff/:staffId/leave-requests`
- `POST /staff-management/leave-requests/:leaveRequestId/approve`
- `POST /staff-management/leave-requests/:leaveRequestId/reject`
- `POST /staff-management/leave-requests/:leaveRequestId/cancel`
- `GET /staff-management/reports/operational`

## Privacy decision

S6 preserves the S5 medical policy: active same-school School Administrators
may access the small medical panel. A narrower medical permission is not
enabled automatically because the project currently has no safe grant owner
for a one-administrator school. Enabling a permission that nobody can grant
would lock the school out; allowing administrators to self-grant would not
meaningfully narrow access.

Before a broader pilot, decide who owns sensitive-access grants. Once that
governance exists, add explicit medical view/edit and restricted-document view
permissions with two-person grant/revocation auditing.

## Migration

`070_staff_compliance_and_leave.sql` creates document metadata, leave requests,
append-only leave events, indexes, row-version triggers, transition guards, and
overlap prevention. Do not edit migration 070 after application; add a new
migration for future changes.

## Manual UAT

1. Open an active staff record as a School Administrator.
2. Upload a PDF license with an expiry date and download it.
3. Try an executable, renamed non-PDF, and file over 10 MB; confirm rejection.
4. Revoke the document and confirm download is rejected.
5. Submit a leave request and confirm an overlapping request is rejected.
6. With two administrators, confirm the submitting administrator cannot
   approve the request.
7. Approve with the second administrator, then cancel with a reason.
8. Open `/staff/reports`, change the expiry window, and export CSV.
9. Confirm the CSV contains no medical values, leave reasons, salaries, or
   storage keys.
10. Change a school, staff, document, or leave ID in a request and confirm the
    backend returns 403 or 404.
