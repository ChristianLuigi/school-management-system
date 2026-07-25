# UAT Checklist

Record environment, image digests, migration verification output, browser/OS, tester, UTC timestamp, evidence link, result, and defect ID for every failed item. Use two schools (A and B) with distinct data. Never use production student data in UAT.

## Preconditions

- [ ] HTTPS certificate valid; HTTP redirects to HTTPS.
- [ ] `/health/live` and `/health/ready` return 200.
- [ ] Migration `status` has no pending or checksum mismatch.
- [ ] Email sender works in the staging domain.
- [ ] Accounts exist for Super Admin, School Admin A/B, Teacher A, Finance Admin A, and Parent A.
- [ ] Teacher A has one assigned section/subject and one deliberately unassigned section/subject.
- [ ] Parent A has one linked guardian/student and one unrelated student.
- [ ] Finance Admin A starts without payroll permissions.

## Super Admin

- [ ] Sign in and view platform administration.
- [ ] Create/view a school through the supported platform workflow.
- [ ] Access school A and B as intended by platform policy.
- [ ] Suspend/reactivate a global account if that workflow is available.
- [ ] Confirm a School Admin cannot access the same platform-only action.
- [ ] Sign out; confirm the old session no longer works.

## School Admin

- [ ] Open `/users`; invite Teacher, Finance Admin, and Parent roles.
- [ ] Confirm Super Admin cannot be selected or submitted.
- [ ] Parent invitation requires a guardian from the same school.
- [ ] Finance permissions accept supported codes; payroll is not default.
- [ ] Resend increments count; revoke makes the old invitation unusable.
- [ ] Activate an invitation and verify membership/operational profile.
- [ ] Suspend a staff membership and verify active sessions are revoked.
- [ ] Reactivate and verify a new login succeeds.
- [ ] Self-suspension and final-active-admin suspension are rejected.
- [ ] Assign/change teacher section and subject; old teacher session is revoked.
- [ ] Change finance permissions; old finance session is revoked.
- [ ] Link a parent to guardians; cross-school guardians are rejected.
- [ ] Change `schoolId` to school B in DevTools; backend returns 403.

## Teacher

- [ ] Login reveals attendance/gradebook modules but not finance/admin/parent tools.
- [ ] Assigned section roster and attendance can be opened and recorded.
- [ ] Assigned subject gradebook can be opened and scores entered.
- [ ] Unassigned section and subject return 403 when IDs are changed manually.
- [ ] A student outside assigned sections cannot be read through a changed URL/ID.
- [ ] After assignment change, old session is rejected; new login reflects new scope.

## Finance Admin

- [ ] Only granted finance functions are visible and server-authorized.
- [ ] Create/issue an invoice, record a payment, and retrieve its receipt.
- [ ] Read access works only when its permission is granted.
- [ ] Payroll is rejected when not explicitly granted.
- [ ] Add `PAYROLL_VIEW`; old session is revoked and new login enables view only.
- [ ] `PAYROLL_MANAGE` remains separately enforced.
- [ ] School B invoice/payment/receipt IDs return 403 or safe 404, never data.

## Parent

- [ ] Parent portal lists only students reachable through active guardian links.
- [ ] Linked student finance summary/receipt access behaves as designed.
- [ ] Changing student or guardian ID to an unrelated/cross-school record returns 403.
- [ ] Removed guardian links disappear after a new login and old session is invalid.
- [ ] Parent cannot access attendance entry, grade entry, finance administration, or users.

## Authentication, recovery, and safe errors

- [ ] Incorrect and unknown-email login responses do not enumerate accounts.
- [ ] Recovery request has the expected generic response.
- [ ] Expired/used reset and invitation tokens fail without leaking token/hash details.
- [ ] Password reset revokes all earlier sessions.
- [ ] Cookies are `HttpOnly`, `Secure`, expected `SameSite`, `/`, and explicit expiry.
- [ ] Untrusted mutation origin is rejected.
- [ ] Repeated login/recovery/activation/resend requests reach HTTP 429.
- [ ] Invalid bearer, revoked, expired, and old authentication-version sessions fail.
- [ ] A forced server error has a request ID and no SQL, stack, file path, or secret.

## Manual security command matrix

Use a staging terminal whose history is protected. Set placeholders locally; do not paste bearer/session/token values into test evidence.

```bash
API=https://school.example.com
WEB=https://school.example.com
# export ADMIN_SESSION, TEACHER_SESSION, PARENT_SESSION, FINANCE_SESSION locally
```

1. Untrusted origin (expect 403):

```bash
curl -i -X POST "$WEB/api/auth/login" -H 'Origin: https://evil.example' -H 'Content-Type: application/json' --data '{"email":"nobody@example.test","password":"not-a-real-password"}'
```

2. Cross-school invitation (expect 403):

```bash
curl -i -X POST "$API/auth/invitations" -H "Authorization: Bearer $ADMIN_SESSION" -H 'Content-Type: application/json' --data "{\"schoolId\":\"$SCHOOL_B\",\"email\":\"scope-test@example.test\",\"roleCode\":\"TEACHER\",\"locale\":\"en\"}"
```

3. Teacher unassigned section (expect 403):

```bash
curl -i "$API/attendance/session?schoolId=$SCHOOL_A&academicYearId=$YEAR_A&sectionId=$UNASSIGNED_SECTION&attendanceDate=2026-07-24" -H "Authorization: Bearer $TEACHER_SESSION"
```

4. Teacher unassigned subject (expect 403):

```bash
curl -i "$API/gradebooks/context?schoolId=$SCHOOL_A&academicYearId=$YEAR_A&sectionId=$ASSIGNED_SECTION&subjectId=$UNASSIGNED_SUBJECT" -H "Authorization: Bearer $TEACHER_SESSION"
```

5. Parent unrelated student (expect 403):

```bash
curl -i "$API/parent/finance/summary?schoolId=$SCHOOL_A&guardianId=$GUARDIAN_A&studentId=$UNRELATED_STUDENT" -H "Authorization: Bearer $PARENT_SESSION"
```

6. Finance action without permission (expect 403; use a valid staging payload):

```bash
curl -i -X POST "$API/finance/payments" -H "Authorization: Bearer $FINANCE_SESSION" -H 'Content-Type: application/json' --data @staging-payment-payload.json
```

7-8. Capture `GET /auth/me` as 200, suspend membership or change scope as Admin, then repeat with the old token and expect 401:

```bash
curl -i "$API/auth/me" -H "Authorization: Bearer $TARGET_SESSION"
```

9. Submit the same invitation/reset token twice; first succeeds, second is rejected. Store neither token in evidence.

10. Final School Admin suspension (expect 400):

```bash
curl -i -X PATCH "$API/auth/invitations/school-users/$FINAL_ADMIN_MEMBERSHIP/status" -H "Authorization: Bearer $ADMIN_SESSION" -H 'Content-Type: application/json' --data "{\"schoolId\":\"$SCHOOL_A\",\"membershipStatus\":\"SUSPENDED\"}"
```

11. Rate limit (login should eventually return 429):

```bash
for i in 1 2 3 4 5 6 7; do curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/auth/login" -H 'Content-Type: application/json' --data '{"email":"rate-limit@example.test","password":"invalid-password-value"}'; done
```

12. Safe error: use the test-only automation for forced failures; in staging, inspect a naturally occurring 5xx by request ID and verify the public body contains no stack, SQL, path, token, or credentials.