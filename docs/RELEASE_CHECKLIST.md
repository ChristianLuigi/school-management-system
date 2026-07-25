# Release Checklist

A checked box requires linked evidence. The Release Owner, Security Reviewer, School Pilot Owner, and Operations Owner must sign the final decision.

## P0 go/no-go gates

- [ ] Source topology is reproducible from a clean clone; `apps/api` gitlink/submodule issue is resolved and CI can read API sources.
- [ ] All CI jobs green on the exact release commit.
- [ ] `pnpm check`, database-backed integration tests, and production audits pass.
- [ ] Fresh PostgreSQL 16 migration, second-run no-op, and checksum verification pass.
- [ ] Upgrade from the staging copy of the previous release passes.
- [ ] Production API and web images build; Compose config validates.
- [ ] Database and uploads backup completed; disposable restore drill passed.
- [ ] Zero open P0/P1 defects and no unreviewed authorization bypass.
- [ ] Production secrets configured in the deployment secret store; no placeholders/default credentials.
- [ ] HTTPS, secure cookies, exact origins, and security headers verified.
- [ ] Health probes, JSON log ingestion, request-ID search, and alert delivery verified.
- [ ] Full role-based UAT signed by named school stakeholders.
- [ ] Previous image rollback and recovery procedure rehearsed.

Any failed P0 gate is an automatic no-go.

## Release quality

- [ ] Migration files are immutable and `schema_migrations` checksums match.
- [ ] No demo users/schools are unintentionally created; legacy deterministic admin is neutralized.
- [ ] Email sender domain, bounce handling, quota, and support process verified.
- [ ] Rate-limit behavior verified from the real proxy path.
- [ ] Cross-school, teacher, parent, and finance scope denials verified server-side.
- [ ] Session invalidation verified after password, membership, assignment, and permission changes.
- [ ] Upload size/type/path controls and persistent volume backup verified.
- [ ] Logs contain no authorization, cookies, passwords, reset/invitation/session tokens, DB URLs, or unnecessary student details.
- [ ] Dependency audit reviewed; any exception has owner/expiry.
- [ ] Capacity assumptions documented for the one-school pilot.

## Deployment record

- Release commit:
- API commit (if separate):
- API image digest:
- Web image digest:
- Migration count/checksum evidence:
- Backup and restore-drill evidence:
- UAT evidence:
- Deployment UTC:
- Release Owner:
- Security Reviewer:
- Operations Owner:
- School Pilot Owner:
- Decision: GO / NO-GO
- Conditions/known P2-P3 defects: