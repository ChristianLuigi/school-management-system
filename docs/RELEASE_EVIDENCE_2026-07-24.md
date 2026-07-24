# Controlled pilot release evidence

Status: **NO-GO pending external P0 gates**

## Candidate

- Branch: `release/controlled-pilot-readiness`
- Topology commit: `020b65c`
- Release-readiness commit: `f318125`
- Maintained-starter commit: `bb62c4f`
- API image: `almac-api:release-candidate`
- Web image: `almac-web:release-candidate`

## Verified locally

- API is normal parent-repository content; no `160000` gitlink remains.
- A complete pre-flatten API Git bundle and original nested Git directory are preserved under ignored local recovery storage.
- A clean bundle clone contains `apps/api/package.json`, contains no API gitlink, and builds the API with a frozen lockfile.
- `pnpm check` passes.
- API lint, 14 API unit tests, web lint/build, and maintained starter lint/test/build pass.
- All 34 database-backed integration tests pass.
- A clean PostgreSQL 16 database applies 63 migrations.
- A second migration run applies zero migrations.
- Migration checksum verification passes.
- A simulated pre-checksum baseline records 62 migrations through `058`, applies `059`, and verifies all 63.
- API, web, and maintained-starter production dependency audits report zero known vulnerabilities.
- Production API and web container images build, run as `node`, and include health checks.
- Production Compose configuration validates with generated non-secret test values.
- Built API liveness and readiness return 200; readiness returns a safe 503 during database loss and recovers to 200.
- Production logs are structured JSON with request IDs and no observed credentials.
- Built web `/login` returns the configured CSP, HSTS, frame, MIME, referrer, and permissions headers.
- PostgreSQL 16 compressed backup and SHA-256 validation pass.
- Disposable restore drill passes with 63 migration records and 74 public tables.
- The prior local immutable API image remains healthy against the candidate schema.
- Argon2 hashing works in the pruned production API image.
- `git diff --check master...HEAD` passes.

## Open P0 gates

- No Git remote is configured. The similarly named `ChristianLuigi/almac-platform` repository is an unrelated Django project and was not modified.
- CI cannot run until the repository owner selects or creates the correct GitHub remote and the release branch is pushed.
- No real staging target, hostname, secret store, or deployment credentials were available.
- Migrations `002` and `019` still require comparison against the actual deployed/staging predecessor described in the canonicalization ADR.
- The actual staging upgrade, HTTPS/proxy/email/alert verification, and role-based stakeholder UAT remain unperformed.
- A staging backup/restore drill and staging rollback rehearsal remain required; the completed local drills do not replace them.
- Release Owner, Security Reviewer, Operations Owner, and School Pilot Owner sign-off is outstanding.

The one-school pilot must not be approved until every P0 checkbox in `docs/RELEASE_CHECKLIST.md` and every applicable UAT item has linked evidence and named sign-off.
