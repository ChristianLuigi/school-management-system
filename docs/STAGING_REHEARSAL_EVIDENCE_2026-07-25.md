# Local staging rehearsal evidence

Status: **REHEARSAL PASS; REAL STAGING AND PILOT REMAIN NO-GO**

## Candidate and isolation

- Runtime candidate source: `d90bcf5498c32ffe1ad5cc49a4a497270e09e39e`.
- Compose project: `almac-staging-rehearsal`.
- The project used independent networks, PostgreSQL and uploads volumes, synthetic credentials, and loopback-only web access.
- The existing `school_mgmt_pg` container and its volumes were not modified.
- Docker Hub was unavailable during the rehearsal. The locally verified `release-candidate` images were retagged after `git diff f318125..d90bcf5` proved there were no production API/web source or lockfile changes; the only runtime-package change was a CI-only test script.

Image digests:

- API candidate: `sha256:3aa97e81c584b0ab59d970e0890a457355369d03035ed24a30a946e01c367cdd`
- Web candidate: `sha256:c902e45b9953245105f3229c91bfaa894ac360ebff9508581ab1896eb5d1a921`
- Previous API: `sha256:a1e06414c74f1a09ed21ae8783d5eb0b229389a0ee75e2d6a841b95a165c7093`
- Previous web: `sha256:9a1d922956046e3b2d863fe49a83d028b5916db6c0658012468e406c564bea3b`

## Passed checks

- Production Compose configuration validated.
- Fresh PostgreSQL 16 installation created distinct bootstrap, migration, and application roles.
- All 63 migrations applied and checksum verification reported 63 verified migrations with no baseline.
- API `/health/live` and `/health/ready` returned 200.
- Web `/login` returned 200 with CSP, HSTS, frame denial, MIME sniffing prevention, referrer policy, and permissions policy.
- An untrusted mutation origin returned 403.
- Unknown-email login returned the safe `Email or password is incorrect.` response.
- Unknown-email password recovery returned the generic accepted response.
- An invalid reset token returned a safe 400 with a request ID.
- An invalid bearer token returned a safe 401 with a request ID.
- Login throttling returned five 401 responses followed by five 429 responses.
- Rehearsal API logs were structured JSON and contained zero matches for authorization, bearer, password-hash, token-hash, session-token, email-key, or database-URL patterns.
- During database loss, liveness remained 200 and readiness returned a safe 503 with `database: down`; readiness recovered to 200 after restart.
- The repository backup script created a PostgreSQL 16 custom-format compressed dump and SHA-256 checksum.
- Disposable restore verification recovered 63 migration records and 74 public tables, then removed its generated drill database.
- The uploads volume was archived with a SHA-256 checksum.
- Previous immutable API/web images remained healthy against the candidate schema.
- Roll-forward to the candidate images restored API readiness and the login page to 200.

## Migration provenance evidence

The only available predecessor is the preserved local development database. Read-only inspection found:

- `schema_migrations` is absent, so it predates checksum tracking.
- `users`, `schools`, and `school_levels` exist.
- The migration `019` demo school exists.
- All three canonical `019` school-level rows exist.
- All three expected secondary grade-level links exist.

This supports the local canonicalization decision for migrations `002` and `019`, but it does not close the deployed-installation provenance gate.

## Gates not satisfied by this rehearsal

- No real staging host, DNS name, deployment secret store, or deployment credentials were available.
- HTTPS used by a real trusted staging certificate and HTTP-to-HTTPS redirect were not exercised; the local rehearsal intentionally used loopback HTTP.
- The Resend key was synthetic, so real staging-domain email delivery was not tested.
- Alert delivery, off-host encrypted backup transfer, and external log ingestion were not tested.
- Authenticated browser UAT and named stakeholder sign-off were not completed. Backend role/scope behavior remains covered by the green 34-test integration suite, but that does not replace stakeholder UAT.
- Migrations `002` and `019` were not compared with an actual deployed release artifact or database.

The one-school pilot remains an automatic no-go until every remaining P0 gate and applicable UAT item has linked real-staging evidence and named sign-off.
