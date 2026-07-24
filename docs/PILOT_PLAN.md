# Controlled Pilot Plan

## Objective and scope

Run one school on a constrained, reversible pilot to validate reliability, security, training, and operating support. Initial scope is authentication/user administration plus the school’s agreed core workflows (for example student records, attendance, gradebook, and manual finance). Defer nonessential configuration and new business features until exit criteria are met.

## Preparation

- Name the school sponsor, product owner, operations on-call, security contact, data owner, trainers, and support triage owner.
- Inventory data, obtain approval, clean/import into staging, and reconcile counts before production import.
- Train one School Admin and a small cohort for each active role.
- Complete release and UAT checklists; publish support hours and severity/escalation rules.
- Establish daily database/uploads backup, off-site transfer, health/log monitoring, and tested rollback.

## Rollout

Week 0: staging rehearsal with synthetic/sanitized data. Week 1: School Admin plus a limited teacher/finance/parent cohort. Week 2+: expand only after daily review shows no unresolved P1 issue. Maintain a parallel/manual record for critical attendance and financial transactions during the agreed initial window. Define which system is authoritative before the day begins; reconcile at day end to avoid double entry.

Do not bulk-enable all users on day one. Issue invitations in controlled groups, confirm email delivery, and audit membership/operational assignments before activation.

## Daily review

Review readiness/availability, 5xx and forbidden trends, login locks, email failures, backup status, storage, response times, support tickets, reconciliation differences, and any scope/session incident. Record decisions, owners, and deadlines in a daily pilot log. P1 security/data-integrity defects pause scope expansion.

## Support and escalation

- P0: active breach, cross-school disclosure, unrecoverable corruption, or platform-wide outage. Stop affected operations, page incident lead immediately, preserve evidence.
- P1: blocked critical school workflow, wrong financial/grade data, authorization failure without confirmed disclosure, or backup failure. Same-day owner and mitigation; pause rollout.
- P2: impaired noncritical workflow with workaround. Triage within one business day.
- P3: cosmetic/usability/documentation issue. Schedule normally.

School users contact the named support owner; they must never send passwords, one-time links, bearer tokens, or unredacted student exports.

## Exit criteria

- At least 10 consecutive school days without a P0 and no unresolved P1.
- Daily backups successful and at least one pilot-period restore drill passed within RTO.
- Attendance, grade, finance, and user-access reconciliation meets the agreed accuracy threshold.
- All role groups complete their agreed workflows and cross-scope tests remain denied.
- Availability/support response targets met; operators demonstrate incident and rollback procedures.
- School sponsor, data owner, Security Reviewer, and Release Owner sign expansion approval.

If exit criteria fail, maintain the limited pilot or roll back to the manual process; do not expand by deadline pressure alone.