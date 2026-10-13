# Admissions refinement — validation

Implemented locally: compact page shell, role-filtered shortcuts, searchable directory with labeled filters and cancelled stale reads, grouped bilingual intake form, native required/email validation, pending-submit guard, and opening the created application. Optional prior-school/document details remain available in expandable sections. Existing class-selection prerequisite and admission decision/conversion rules are retained.

The detail checklist now reports recorded items rather than a percentage that could be mistaken for approval. Its indicators remain guidance; backend validation determines whether confirmation/conversion is permitted.

Browser checks with fictitious applicants:

- [ ] School Admin creates an application with a requested class; saved application opens and all entered candidate/contact/document fields are correct.
- [ ] Administrative Staff creates through the existing restricted intake form; the saved restricted record opens without decision, fee, medical, or conversion controls.
- [ ] Blank names and invalid email cannot be submitted. A rejected request retains entered values. Double-clicking submit sends one request while pending.
- [ ] Search by name/number/phone, change status, and clear filters. Stale responses do not overwrite current results; loading is distinct from an empty result.
- [ ] Missing or failed academic-structure check explains the blocker and offers configuration/retry to authorized creators.
- [ ] At 375px and keyboard-only, labels remain visible, optional sections can be opened, and the list scrolls within its table container.
- [ ] French/English candidate, class and status labels match the selected language. Legacy summary/detail action panels still require a full language review.
- [ ] Checklist totals do not imply that an admission is approved; existing decision/conversion and cross-school authorization checks still apply.

No database migration is required. Add these observations to the UX7 results register before school sign-off.
