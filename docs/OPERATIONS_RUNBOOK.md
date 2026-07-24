# Operations Runbook

## Health and logs

- Liveness: `GET /health/live` proves the API process can respond.
- Readiness: `GET /health/ready` returns HTTP 503 when PostgreSQL is unavailable.
- Compatibility health: `GET /health` has readiness semantics.
- Public web probe: `GET /login` through HTTPS.

```bash
curl --fail https://school.example.com/login
docker compose --env-file .env.production -f compose.production.yml exec api \
  node -e "fetch('http://127.0.0.1:4000/health/ready').then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)})"
docker compose --env-file .env.production -f compose.production.yml logs --since=15m api web caddy
docker compose --env-file .env.production -f compose.production.yml ps
```

Production API and proxy logs are JSON. Search by `requestId`; do not ask users for passwords or tokens. Logs redact authorization, cookies, password fields, token-like fields, and database credentials. Store logs in an access-controlled system with retention appropriate for student data.

## Restart

Check readiness and current logs first. Restart one service at a time:

```bash
docker compose --env-file .env.production -f compose.production.yml restart api
docker compose --env-file .env.production -f compose.production.yml restart web
```

Do not restart PostgreSQL as a first diagnostic step. Never delete volumes to solve a startup problem.

## Failed migration

1. Leave API stopped if the migration job failed.
2. Capture the migration error and request ID, excluding secrets.
3. Run migration `status` and `verify` from the candidate image.
4. A checksum mismatch means a historical file changed: restore the canonical file; do not rewrite history or update the checksum manually.
5. A failed migration at or after 054 is transactional. Older migrations may contain legacy transaction behavior; inspect database state before retrying.
6. If recovery is unclear, restore the pre-upgrade backup into a disposable database and reproduce there.

## Database outage

Confirm the readiness failure, container health, disk space, connection limits, and infrastructure status. Prevent repeated deploy/restart loops. Restore service through the database owner; verify migrations, readiness, login, and one read/write workflow afterward.

## Email failure

Check provider status, sender-domain verification, rate/quotas, and structured application events. Invitations and reset tokens must never be copied from the database into support messages. Once delivery is restored, use the authorized resend workflow. Alert on sustained delivery failures rather than individual transient failures.

## Disk or storage alert

Check PostgreSQL volume, Docker logs, uploads volume, backup staging area, and Caddy data. Move verified backups off-host. Do not blindly delete database files, volumes, uploads, or active backups. Apply documented retention only after checksum/off-site verification.

## Emergency user/session revocation

Prefer the authenticated administration UI for school membership suspension. A School Admin affects only their school. Platform-wide account suspension is reserved for Super Admin. If the UI is unavailable, a database operator may use a reviewed transaction that increments `users.authentication_version` and revokes non-revoked `auth_sessions` for the exact verified user UUID. Record actor, reason, ticket, UUID, timestamp, and row counts; never search by a partial name.

## Incident handling

Classify severity, appoint an incident lead, preserve evidence, reduce impact, communicate a safe status, and maintain a UTC timeline. Do not paste credentials, tokens, sensitive student records, or raw database dumps into chat. After containment, rotate affected secrets, validate cross-school isolation, document root cause and corrective actions, and obtain release-owner approval before restoring normal rollout.

## Recommended alerts

- API unavailable for 2 minutes; readiness failing for 1 minute.
- HTTP 5xx rate above 2% for 5 minutes.
- Login failures or account locks materially above the 7-day baseline.
- Repeated forbidden cross-school requests from one account/IP.
- PostgreSQL storage above 75% warning and 85% critical.
- Backup missing/failed or restore drill overdue.
- Email-delivery failure rate above 5% for 10 minutes.
- Container restart loop, high connection saturation, or migration job failure.

Metrics/error tracking remain provider-neutral. Forward JSON logs and health probes to the pilot operator’s existing platform; configure provider credentials only through deployment secrets.