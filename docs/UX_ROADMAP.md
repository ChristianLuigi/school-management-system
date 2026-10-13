# Usability roadmap

## UX1 — Students reference interface

Implemented locally; authenticated browser validation remains to be completed.

- Keep one page title, a short optional description, and a concise list heading.
- Use `schoolActionClass("primary")` for the main task; use the default secondary style for supporting actions. Keep important icon labels visible on mobile.
- Reuse `SchoolBadge` with a written status; never communicate status by color alone.
- Reuse `SchoolFeedback` for errors (`alert`) and confirmations (`status`), with an explicit recovery action when useful.
- Reuse `EmptySchoolState` with a context-specific action: clear filters for no matches, add a record for an empty directory, or guidance without unauthorized controls for read-only users.
- Keep visible filter labels, keyboard focus indicators, and loading announcements. Do not show a successful empty result while loading or after a failed request.
- Add equivalent French and English translation keys. Keep existing backend authorization intact.

The Students directory applies these patterns. Full classes can be selected as directory filters; this does not change enrollment capacity rules. Existing create/import role gates remain unchanged.

### Browser validation checklist

Use test data and authorized accounts; do not modify real student records for this check.

- [ ] Open `/students` in French and English. Verify the title, actions, filters, empty states, and feedback have no untranslated keys.
- [ ] At desktop and 375px mobile widths, verify the toolbar wraps, filters fit, and Profile/Edit/Import labels remain visible.
- [ ] Navigate with Tab. Verify focus is visible and each filter has an accessible name, including Class/section.
- [ ] Throttle the network and reload. Verify loading is shown, without a premature “No students” message.
- [ ] Search for a nonexistent student. Choose Clear filters and verify the directory returns, starting on page 1.
- [ ] Check an empty school as an authorized creator and as a read-only user. Only the creator should see Add student.
- [ ] Block the student-list request in DevTools, refresh, then unblock it and select Try again. Verify filters remain unchanged and the list recovers.
- [ ] Quickly change searches. Verify an older response cannot overwrite the latest result.
- [ ] Select a full class in the directory filter. Verify its students are listed; enrollment limits must remain unchanged elsewhere.
- [ ] As School Admin, verify CSV import remains available. As Administrative Staff, verify create/edit remain available but CSV import does not appear.

### Local checks

From `apps/web`:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js components/school-ui.tsx components/students-management-client.tsx components/section-selector-client.tsx lib/i18n/messages.ts "app/(dashboard)/(school)/(core)/students/page.tsx"
pnpm build
```

Run `git diff --check` from the repository root. No database migration is required for UX1.

## Following batches

### UX2 — Enrollment refinement

Implemented locally; authenticated browser validation remains pending.

- Existing identity → placement → review flow retained, with visible step names on mobile, field-specific identity errors and focus, selected class/year and entered details in the review.
- Entries stay in React state when validation or saving fails. No student data is stored in browser local storage; closing/reloading the page still discards unsaved entries.
- Create controls lock during submission and after an accepted creation. Administrative Staff now open the saved identity record rather than silently clearing the form. This is a UI double-submit guard, not server-side idempotency.
- School Admins see independent guardian, placement, and document reminders on the overview. These are guidance, not new mandatory enrollment requirements. Guardian linking remains a separate saved operation.
- Guardian editing now uses a real form (Enter submits; email validation runs), announces outcomes, retains failed entries, and prevents Add/Edit from discarding an open draft or changing it during a save.
- Administrative Staff still cannot manage placement, guardians, or private documents. No backend, migration, capacity rule, or role policy changed.

Run the focused validation tests with **pnpm --dir apps/web test:ux** (Node 22.6+ with type stripping, or Node 24). Tests cover empty/long names, invalid/future dates, optional dates, local date formatting, and independent progress indicators.

Browser checks:

- [ ] In both languages and at mobile width, complete all three steps. Go back and verify all entered values remain.
- [ ] Enter whitespace-only names or a future birth date; verify creation is blocked and the relevant field is identified.
- [ ] Select a class, review its name/year, then change it; verify the summary updates. Planned-year availability is unchanged.
- [ ] Simulate a rejected save. Verify values remain, no success is announced, and correction/retry is possible.
- [ ] Double-click Create. Verify only one request is sent while the first is pending, then the saved record opens.
- [ ] Create without a class. Verify Registered/class-pending guidance and follow the placement reminder.
- [ ] Add a guardian from the saved record. Verify invalid email is blocked, failed saves retain data, and the reminder updates after success.
- [ ] As Administrative Staff, create a student and verify the identity-only saved record opens, without guardian/placement/document management controls.
- [ ] Verify document reminders do not block enrollment or imply uploaded files have been verified.

### UX3 — Attendance

Implemented locally; authenticated browser validation remains pending.

- Applies to the active `/attendance` route and `AttendanceSessionClient`, not the legacy offline workspace.
- New pupils are **Not marked**, not implicitly Present or Absent. All pupils must be explicitly marked before submitting; Mark remaining present preserves existing absences, lateness, excuses, and notes.
- The roster identifies the class/date/session, shows compact counts, and keeps Save at the bottom of the viewport. No redundant per-row status badge.
- Changes to class/date/session, refresh, and ordinary in-app links prompt before discarding edits. Browser reload/close uses the native warning. Browser history Back/Forward and programmatic navigation are not universally interceptable here; verify those paths during UX6. Unsaved data is not stored locally.
- Pending reads are aborted on context changes. A roster cannot be submitted against another context, and inputs lock while saving. Double-click protection is client-side, not a new API idempotency feature.
- Save failures preserve entries. Successful saves remain visible after refresh; a failed follow-up read says that saving succeeded rather than inviting an unnecessary resubmission.
- Locked sessions are read-only in the UI. The active API upsert now atomically refuses to overwrite LOCKED status before writing attendance records. Existing teacher/school authorization is unchanged; no migration is needed.

Automated checks: `pnpm --dir apps/web test:ux`; focused API Jest suites `attendance-session-lock.spec.ts` and `attendance-dashboard-query.spec.ts`. The lock regression tests exercise service behavior with a transaction stub; a real-database concurrency test remains outside this batch.

Browser checklist (School Admin and an assigned Teacher):

- [ ] In French and English, choose class/date/session and verify the roster heading matches.
- [ ] In a new session, verify all pupils start unmarked, counts distinguish unmarked/absent, and Save is disabled until all are marked.
- [ ] Mark one pupil absent with a note, then Mark remaining present. Verify the absence/note are unchanged.
- [ ] Edit a saved session; verify Unsaved changes appears. Undo the edit and verify the saved state returns.
- [ ] Change class/date/session or refresh with unsaved edits. Cancel retains the context and entries; confirm loads the new context.
- [ ] Use a normal sidebar link and reload while dirty; verify the warning. Check browser-history navigation separately as noted above.
- [ ] Throttle requests and rapidly change classes. Verify an older response never replaces the selected roster.
- [ ] Fail a POST; verify entries remain. Save successfully, then fail the follow-up GET; verify success remains visible alongside the refresh error.
- [ ] Double-click Save; verify one request while pending and controls disabled until completion.
- [ ] Open a locked session: controls are disabled. Against a disposable database, submit to `/attendance/session/submit` for that session and verify 403 and unchanged records.
- [ ] Verify unassigned/cross-school section requests still fail at the API.

### UX4 — Payments

Implemented locally; cashier browser validation remains pending.

- The existing student → invoice → drawer → payment → confirmation → receipt workflow is retained, with shorter headings, icons, and bilingual payment labels.
- Invoice balance, resulting balance, and currency stay visible while entering a payment. Review includes reference, notes, business date, and currency.
- Payment entry is hidden during review; choose Edit payment to change it. Student/invoice controls cannot change the reviewed payment. Successful posting hides the old payment form; a partial balance offers an explicit Another payment action.
- Student and drawer requests cancel older requests and clear their prior context. A failed drawer read offers retry rather than implying the drawer has not been opened. Payment requires a confirmed drawer in the invoice currency.
- A synchronous guard prevents rapid duplicate confirmation. Retries keep the existing API idempotency key for the same payload. An uncertain network/gateway response retains the review and locks editing until that confirmation is retried. The key is held in memory; reloading the page loses that recovery state, so verify the ledger before starting a fresh payment after an uncertain result.
- Amount validation matches the API's two-decimal limit; enabled methods and non-cash references are checked before review. Backend payment permissions, ledger validation, reconciliation, and idempotency remain authoritative.
- Supervisor/close-drawer screens retain their existing copy; full language cleanup and keyboard/mobile review remain in UX6. No API or migration changes in this batch.

Focused tests: `pnpm --dir apps/web test:ux` covers partial/full payments, overpayment, invalid precision, currency mismatch, enabled methods, and non-cash references.

Browser checks using staging test invoices:

- [ ] Search/select a student, select an invoice and verify its currency and balance.
- [ ] Enter a partial payment; verify the projected balance and all review fields.
- [ ] Choose Edit payment, change amount/reference, and review again. Verify the confirmation reflects the changes.
- [ ] Double-click confirmation; verify one request while pending. Check the receipt against the ledger.
- [ ] Simulate a lost response or 503; retry the same confirmation and verify one ledger payment/receipt using the same idempotency key.
- [ ] Fail a student/drawer read or rapidly change selections; verify old student/currency data cannot be used and retry is available.
- [ ] Confirm an overpayment, a third decimal, and non-cash without reference are blocked before review.
- [ ] Print/open A4 and 80mm receipts; after a partial payment choose Another payment and verify refreshed balance and cleared reference/notes.
- [ ] Verify closed drawers and missing backend permissions still reject posting.

### UX5 — Navigation and dashboard

Implemented locally; browser validation remains pending.

- The top bar shows the current school name, including on mobile, with translated navigation/account controls and wrapping actions.
- Dashboard shortcuts use the existing role-filtered allowed module list. Attendance links carry the date displayed on the dashboard. Finance links go through the finance module's existing permission checks.
- School switching checks the response before navigating. Failed switches display an error and retain the current school; successful switches land on the new school's dashboard so old record IDs and academic-year filters are not reused.
- Sidebar links have visible keyboard focus; existing active-route indicators remain. Breadcrumbs now label new records, staff details, and payroll approvals in French/English.
- Academic-year selections continue to belong to their existing modules. No global year selector was added, and no unsupported year query is propagated between modules.

Browser checks:

- [ ] As School Admin, Teacher, and Finance Admin, verify dashboard shortcuts match visible/authorized modules.
- [ ] Verify attendance chart/shortcut opens the dashboard's displayed date.
- [ ] Switch schools from a student detail or year-filtered page; verify the new school landing page has no previous record/year parameters.
- [ ] Fail the school-switch request; verify the school name and selection stay unchanged and an error appears.
- [ ] Check top bar wrapping, current school name, sidebar focus/active state, and breadcrumbs on mobile in both languages.
- [ ] Verify existing academic-year choices still work in their modules and are reset appropriately when changing school.

### UX6 — Accessibility and recovery

Implemented targeted improvements to the shared navigation, enrollment steps, and payment recovery. Browser/device validation remains pending; this is not a whole-application accessibility certification.

- Closed mobile navigation is hidden from keyboard/screen-reader access. Opening it focuses the close control, keeps Tab/Shift+Tab inside the drawer, disables the background, locks scrolling, supports Escape, and restores focus on close. Desktop navigation remains available after viewport changes. The menu button exposes its expanded state.
- Failed logout requests stay on the current screen and announce an actionable error. A successful server response is required before redirecting.
- Enrollment step buttons stack icon/label on small screens and have explicit keyboard focus indicators.
- Payment keyboard confirmation ignores composition and repeated key events and supports Ctrl/Command+Enter. Reload/close warns during pending or uncertain payments; ordinary navigation links cannot interrupt a pending post and prompt before leaving an uncertain result. Exact retries continue using the same existing in-memory idempotency key.
- Earlier batch protections remain: drafts survive rejected saves, stale reads cannot replace the selected roster/student, loading states do not announce successful emptiness, and status labels supplement color.

Browser/device checks (must be signed off in UX7):

- [ ] At 375px, Tab cannot enter a closed sidebar. Open it with the menu button, cycle Tab/Shift+Tab, press Escape, and verify focus returns to the trigger and scrolling resumes.
- [ ] Resize open navigation to desktop and back; verify no hidden/inert page or stuck scroll lock remains.
- [ ] Use Skip to content, visible focus indicators, screen-reader labels/status announcements, and 200% zoom across enrollment, attendance and cashier.
- [ ] At narrow widths verify step labels, payment review fields, action labels and table scrolling remain usable without page-wide overflow.
- [ ] Simulate failed logout; verify no login redirect and retry succeeds after recovery.
- [ ] On Slow 3G/offline, test rejected saves and recovery in all three workflows. Confirm entries remain and errors identify the next action.
- [ ] During a pending/uncertain payment, verify normal links and reload warn/block appropriately; retry recovers the same ledger entry. Check browser Back/Forward and school-switch/programmatic navigation separately: those paths are not universally intercepted by the link guard.
- [ ] Finish remaining legacy English strings in cashier drawer/supervision and guardian screens after the school staff language review. New core payment labels and shared navigation are bilingual; older screens still need that review.

### UX7 — User validation

Prepared: [French staff test protocol](UX7_USER_TESTING.md), [results and sign-off register](UX7_RESULTS.md), and a refreshed local baseline (16 UX tests and 5 focused API tests passed).

Pending: identify the tested environment/build and participants, run real enrollment/attendance/payment sessions without coaching, record and fix observed defects, retest, and obtain school/technical sign-off. No manual case or release approval is marked complete without evidence.

Implement and verify each batch independently. UI cleanup must not alter permissions, financial controls, auditing, or approval rules. Commits and deployments require separate authorization.
