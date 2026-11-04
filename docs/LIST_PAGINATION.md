# List pagination

Browsing collections use 10 items per page with bilingual Previous/Next controls. Controls are omitted when a collection fits on one page. Students and the staff directory retain their existing server-side paging, now defaulting to 10 items (student page-size choices remain available).

## Coverage

- Students, admissions, staff directory, users and invitations.
- Invoice browsing, student invoice/payment history, cashier search/session lists, billing plans and run results, corrections/credits, deposits, accounting periods and bank accounts.
- Payroll runs, compensation profile directory, approval inbox, run staff items, workflow history and payment registers.
- Academic section/subject lists, assessment browsing, gradebook overview/approval and report-card readiness/batches.
- Student/staff documents, guardians, leave requests, employment history, teacher assignments, staff operational reports and attendance summaries/history.
- Student/staff import previews. Student preview no longer hides everything after the first 25 rows; all returned preview rows are navigable. Import payloads still contain the original full dataset.
- Super Admin collections retain their previously added pagination.

## Safety boundaries

`PaginatedCollection` changes rendering only: it does not slice arrays used for totals, exports, mutation payloads or bulk selection. Table controls render inside a correctly spanned table row. Global row indexes remain consistent. Compensation profile editors stay mounted between pages to retain local drafts. Before browser printing, the collection renders the full loaded dataset and hides paging controls.

Attendance marking and grade-entry rosters, assignment checklists, validation-blocker lists, dropdown options, invoice lines, and dedicated print templates intentionally remain complete. Paging these blindly could hide unfinished work or break save/print behavior.

This is display pagination, not a replacement for every API query. Existing backend retrieval limits (for example capped recent-history or invoice queries) remain unchanged. Item ranges describe the loaded collection, not a fabricated count of all database records. Students/staff and platform Activity have server paging; other large capped APIs still need server-pagination expansion before older records beyond their retrieval window can be browsed. No permission checks or schema were changed for this school-side pass.

## Verification

- Use 23+ disposable records in each relevant view: pages contain 10/10/3, without duplicates within a fixed dataset.
- Filter/search on a later page and confirm a valid first page. Remove a last-page item and check clamping.
- Review an import preview beyond row 25, then verify import still sends every original row.
- On payroll profiles, start an edit, change page and return; the draft must remain.
- Print an invoice payment history/register with 23 loaded entries: print preview must contain all 23, not just the selected page.
- Verify CSV exports/totals still cover the original dataset and protected records remain inaccessible.
- Test in FR/EN and on mobile. Browser print and real-user workflow checks remain manual; compilation is not a substitute for this checklist.
