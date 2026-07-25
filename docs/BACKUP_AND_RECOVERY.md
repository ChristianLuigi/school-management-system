# Backup and Recovery

## Policy

Pilot targets: RPO 24 hours and RTO 4 hours. Run a database backup at least daily, retain 14 daily plus 8 weekly recovery points, copy them encrypted to a separate account/region, and back up the uploads volume on the same schedule. A backup is not accepted until its checksum is stored and a recent representative backup has passed a disposable restore drill.

Encryption keys, database credentials, DNS access, email-provider access, and the recovery runbook must be escrowed with two authorized maintainers. Test recovery quarterly and before the first production pilot.

## Create a database backup

The host needs PostgreSQL 16 client tools. The scripts require the `pg_dump`/`pg_restore` major version to match the database server and refuse mismatches because newer clients can emit settings an older server cannot restore. `DATABASE_URL` should be injected by the secret manager, not placed on the command line or in shell history.

```bash
export DATABASE_URL='injected-by-secret-manager'
export BACKUP_DIR=/srv/almac-backups/staging
export BACKUP_RETENTION_DAYS=14
./infra/scripts/backup-postgres.sh
```

PowerShell equivalent:

```powershell
$env:DATABASE_URL = 'injected-by-secret-manager'
./infra/scripts/backup-postgres.ps1 -BackupDirectory C:\Secure\AlmacBackups -RetentionDays 14
```

The script uses custom compressed `pg_dump`, restrictive file permissions, a UTC timestamp, archive validation, SHA-256 checksum, and bounded retention. Copy both `.dump` and `.sha256` off-host using the organization’s encrypted backup transport. Back up the Docker `uploaded_files` volume separately and associate it with the same recovery timestamp.

## Disposable restore drill

Never target an existing application database. Provide an administrative URL capable of creating a temporary database; the script generates an exact `backup_restore_drill_*` name and removes only that database on exit.

```bash
export ADMIN_DATABASE_URL='postgresql://drill_admin:REDACTED@127.0.0.1:5432/postgres'
export BACKUP_FILE=/srv/almac-backups/staging/almac_20260724T020000Z.dump
./infra/scripts/verify-backup-restore.sh
```

PowerShell equivalent:

```powershell
./infra/scripts/verify-backup-restore.ps1 `
  -AdminDatabaseUrl 'postgresql://drill_admin:REDACTED@127.0.0.1:5432/postgres' `
  -BackupFile 'C:\Secure\AlmacBackups\almac_20260724T020000Z.dump'
```

The drill checks the archive checksum when adjacent, restores with errors fatal, queries `schema_migrations`, and verifies public tables exist. Follow with application readiness and sampled row-count/business-consistency checks when using a production-shaped backup.

## Manual guarded restore

Create a new empty database whose name includes `restore` or `drill`. The restore script prints the resolved database and requires exact confirmation:

```bash
export RESTORE_DATABASE_URL='postgresql://restore_admin:REDACTED@db:5432/almac_restore_20260724'
export CONFIRM_RESTORE_DATABASE=almac_restore_20260724
export BACKUP_FILE=/secure/path/almac_20260724T020000Z.dump
./infra/scripts/restore-postgres.sh
```

It refuses an apparent production target unless `ALLOW_PRODUCTION_RESTORE=YES_I_UNDERSTAND` is also supplied. That override is an incident-only last resort and still requires exact database confirmation. Prefer restoring to a new environment, validating it, then switching traffic.

## Recovery validation

1. Check checksum and archive listing.
2. Restore database and matching uploads into isolated infrastructure.
3. Run `db:migrate:verify`; do not apply pending migrations until the recovery point is understood.
4. Start the matching historical application images.
5. Verify readiness, school/user counts, recent attendance, invoices/payments, receipt access, and representative file downloads.
6. Confirm cross-school and role-scope denials.
7. Record elapsed time, recovered timestamp, data gaps, and sign-off.

Backup success, off-site copy success, restore-drill age, and storage capacity must be monitored. A cron/systemd schedule is acceptable for the pilot if failures are delivered to an actively monitored channel.