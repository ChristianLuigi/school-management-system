#!/usr/bin/env bash
set -Eeuo pipefail
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
if [[ ! -f "$BACKUP_FILE" ]]; then echo "Backup file does not exist: $BACKUP_FILE" >&2; exit 2; fi
TARGET_DATABASE="$(psql "$RESTORE_DATABASE_URL" -XAtqc 'SELECT current_database()')"
SERVER_VERSION_NUM="$(psql "$RESTORE_DATABASE_URL" -XAtqc 'SHOW server_version_num')"
CLIENT_MAJOR="$(pg_restore --version | awk '{print $3}' | cut -d. -f1)"
SERVER_MAJOR="$((SERVER_VERSION_NUM / 10000))"
if [[ "$CLIENT_MAJOR" != "$SERVER_MAJOR" ]]; then echo "Refusing restore: pg_restore major $CLIENT_MAJOR must match PostgreSQL server major $SERVER_MAJOR." >&2; exit 6; fi
if [[ -z "$TARGET_DATABASE" ]]; then echo "Unable to resolve the restore target database." >&2; exit 3; fi
if [[ ! "$TARGET_DATABASE" =~ (test|drill|restore|scratch) ]] && [[ "${ALLOW_PRODUCTION_RESTORE:-}" != "YES_I_UNDERSTAND" ]]; then
  echo "Refusing to restore to apparent production database '$TARGET_DATABASE'." >&2; exit 4
fi
if [[ "${CONFIRM_RESTORE_DATABASE:-}" != "$TARGET_DATABASE" ]]; then
  echo "Restore target resolved to: $TARGET_DATABASE" >&2
  echo "Set CONFIRM_RESTORE_DATABASE=$TARGET_DATABASE to continue." >&2; exit 5
fi
printf 'Restore target resolved to database: %s\n' "$TARGET_DATABASE"
if [[ -f "${BACKUP_FILE}.sha256" ]]; then (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "${BACKUP_FILE}.sha256")"); fi
pg_restore "$BACKUP_FILE" --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --exit-on-error --no-owner --no-acl
psql "$RESTORE_DATABASE_URL" -Xv ON_ERROR_STOP=1 -Atqc "SELECT 'schema_migrations=' || COUNT(*) FROM schema_migrations;"
printf 'Restore completed for %s.\n' "$TARGET_DATABASE"