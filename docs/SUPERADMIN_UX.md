# Super Admin refinement

## Current pass

- Shared semantic surfaces, text, borders, forms and feedback across dashboard, schools, school details, school creation, staff, onboarding, invitations, activity and reports.
- Compact shared panels/buttons, localized school-status/management badges, icon-assisted actions and empty states.
- Dashboard: remove duplicated signed-in account panel; cancel stale trend requests, hide stale results during reload, label filters, preserve a no-data state.
- Activity/onboarding: only the latest request updates the screen. Activity event-type search applies on submit instead of making a request per keystroke; school selection still reloads automatically.
- School directory: accent-insensitive search, status/management filters, result count, responsive secondary columns and reset action.
- School lifecycle: confirmation before status changes, no suspension action on archived schools, one pending mutation at a time, native modal with code confirmation before deletion. Existing API authorization and lifecycle endpoints remain authoritative.

## Manual acceptance checks

Long lists show 10 items per page with Previous/Next and item ranges: Activity, school directory, staff directory, onboarding tracker, dashboard onboarding details and the legacy staff/invitation component. School/staff/onboarding lists paginate the existing fetched dataset; Activity uses API `limit`/`offset`, so older events beyond the previous 50-item window are reachable. Deploy the API update with the web change. No schema migration is needed. Live events arriving during offset-based browsing may shift later pages; reload the first page for the latest feed.

Pagination checks: use at least 23 disposable records, visit all three pages, verify 10/10/3 rows, Previous disabled initially and Next disabled finally. Apply filters while on a later page and verify a reset to page one; delete a final-page item and verify a valid page remains. Activity's editable event-type field only changes the results when Apply is submitted, not when paging.

1. Sign in as Super Admin; verify every platform page in light/dark and FR/EN.
2. Search schools by partial name/code and accents; combine filters and reset.
3. Cancel a status-change confirmation: no network mutation should occur.
4. Open deletion, cancel with Escape, reopen; confirm focus stays in the native dialog. A mismatching code cannot submit; a matching code only enables the existing delete operation.
5. Switch dashboard filters quickly: the last selected scope must win; no old series should appear as current.
6. Resize to mobile: tables scroll, header actions wrap, school details retain less prominent metadata.
7. Verify ordinary school accounts cannot enter platform routes; UI changes do not grant permissions.

## Remaining work

This pass does not certify full visual UAT. Detailed create-school, staff and invitation forms still need workflow-specific review. Static platform copy, chart labels, known feedback and onboarding actions now use the platform translation catalog with an AST regression gate; see I18N_MIGRATION.md for scope and audit-record handling. School names, email addresses and original audit records are data, not translated UI text. Remaining school modules and printed exports need their own coverage review.

No API/schema changes or deployment are required by this pass. Do not test deletion against real schools as a visual QA shortcut; use disposable staging records.
