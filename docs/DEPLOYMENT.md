# Deployment

## Scope and prerequisites

This runbook deploys the controlled-pilot stack in `compose.production.yml`: Caddy, Next.js web, NestJS API, the one-shot migration job, and PostgreSQL 16. Use Linux with Docker Engine 25+ and Docker Compose v2, DNS control for the public hostname, outbound HTTPS for email delivery, and encrypted off-host backup storage.

Node.js 22 and pnpm 10.33.0 are used by CI and containers. PostgreSQL is internal-only; do not add a public database port.

`apps/api` is normal parent-repository content. A clean checkout must contain `apps/api/package.json`, and `git ls-files --stage apps/api` must not contain mode `160000`. The API and web applications are versioned, tested, and released from the same commit. See `docs/decisions/ADR-API-REPOSITORY-TOPOLOGY.md`.

## Environment

Copy `.env.production.example` to an untracked `.env.production`. Replace every placeholder. Use a URL-safe database password because Compose interpolates it into `DATABASE_URL`; `%`, `@`, `:`, `/`, `?`, and `#` must be percent-encoded if present. Generate independent high-entropy credentials with an approved secret manager. Never place real values in a Dockerfile, Compose file, shell history, support ticket, or log.

Required values are `APP_DOMAIN`, `ACME_EMAIL`, `POSTGRES_DB`, the distinct bootstrap/migration/application database role credentials, `RESEND_API_KEY`, and `AUTH_EMAIL_FROM`. Production startup rejects missing/weak database credentials, non-HTTPS public URLs, invalid CORS origins, invalid email configuration, non-`__Host-` session cookies, or a relative upload path.

Validate without starting services:

```bash
docker compose --env-file .env.production -f compose.production.yml config --quiet
```

## Least-privilege database roles

Fresh volumes run `infra/db/init/001-create-runtime-roles.sh` once. The bootstrap owner, migration owner, and application login must be distinct. The migration owner owns the database and creates schema objects; default privileges grant the application login only table DML and sequence use. The API never receives bootstrap or migration credentials. PostgreSQL has no public production port.

For an existing PostgreSQL volume, Docker initialization scripts do not run again. A DBA must create the distinct roles, transfer database/schema object ownership to the migration owner, set default privileges, grant the application role only `CONNECT`, schema `USAGE`, table `SELECT/INSERT/UPDATE/DELETE`, and sequence `USAGE/SELECT/UPDATE`, and then test both migration and application connections. Do this in staging from a verified backup first; do not grant the application role superuser, role creation, database creation, replication, or schema ownership.
## First deployment to a fresh database

```bash
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d postgres
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml run --rm migrate node dist/migration-cli.js verify
docker compose --env-file .env.production -f compose.production.yml up -d
docker compose --env-file .env.production -f compose.production.yml ps
curl --fail https://school.example.com/login
```

The migration job uses the complete filename as identity, lexically orders files, verifies SHA-256 checksums, and takes a PostgreSQL advisory lock. Duplicate numeric prefixes are supported. Demo seed data is not part of production migration execution. Migration `059_disable_legacy_seed_super_admin.sql` suspends only the untouched deterministic legacy account from migration 022; it does not modify an account whose password was already changed.

### Create the initial Super Admin

Public account registration is intentionally disabled. On a fresh installation, create the first real Super Admin once, from a trusted Windows workstation, after all migrations have completed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-super-admin.ps1
```

The script prompts securely for the Neon direct connection string and the new password, passes neither value on the command line, and removes its temporary environment variables afterward. The command requires the exact confirmation `CREATE_INITIAL_SUPER_ADMIN`, validates the normal password policy, records authentication and platform audit events, and refuses to run if a real Super Admin or the requested email already exists. It ignores only the exact untouched legacy account disabled by migration 059.

Do not add bootstrap credentials to Render, Vercel, `.env` files, image build arguments, or application startup commands. If the account already exists, use password recovery instead of rerunning the bootstrap. The Super Admin can then create each school and its first School Admin; School Admins create staff records and grant login access through invitations.

## Existing installation baseline

Baseline is an administrative exception, not a normal deployment step. First take and restore-verify a backup. Compare the existing schema to a clean database built through `058_operational_user_access.sql`. The runner requires an empty `schema_migrations` table, verifies critical tables/columns, and requires the literal confirmation `BASELINE_EXISTING_SCHEMA`.

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm migrate \
  node dist/migration-cli.js baseline \
  --through 058_operational_user_access.sql \
  --confirm BASELINE_EXISTING_SCHEMA
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml run --rm migrate \
  node dist/migration-cli.js verify
```

Do not baseline if the schema comparison is inconclusive. Escalate instead. Never edit a recorded migration: add a new corrective migration.

Migrations `002_core_tables.sql` and `019_backfill_school_levels.sql` received pre-checksum canonical repairs so that the historical chain can build a clean database. Before baselining any installation that predates `schema_migrations`, compare its schema and release evidence using `docs/decisions/ADR-LEGACY-MIGRATION-CANONICALIZATION.md`. If an installation already records either filename with a different checksum, stop: do not overwrite migration history or silently accept the mismatch.

## Staging

Use a dedicated hostname, database volume, email sender/test domain, uploads volume, and secrets. Never copy production session data to staging. Deploy the candidate image tag, run migrations, restore a sanitized production-shaped backup if approved, execute `docs/UAT_CHECKLIST.md`, then record the image digest and UAT sign-off.

## Upgrade

1. Announce the window and capture database plus uploads backups.
2. Record current image tags/digests and `db:migrate:verify` output.
3. Build immutable candidate images and run CI/UAT.
4. Set `APP_VERSION` to the candidate tag.
5. Run the one-shot migration job; stop if it fails.
6. Start API/web, verify `/health/live`, `/health/ready`, login, email delivery, and critical role workflows.
7. Monitor 5xx, forbidden requests, latency, storage, and email failures.

## Rollback

Application rollback means restoring the previous immutable API/web image tags and restarting them. SQL migrations are forward-only: do not improvise reverse SQL. If the new schema is backward-compatible, roll back the images and keep the schema. If it is not, declare an incident, stop writes, restore the pre-deployment database and uploads backups into a new verified environment, then switch traffic. Record recovery decisions and evidence.

```bash
APP_VERSION=previous-tag docker compose --env-file .env.production -f compose.production.yml up -d --no-deps api web
```

Never use `docker compose down -v` in staging or production.
