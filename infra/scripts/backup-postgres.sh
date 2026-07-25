#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
case "$BACKUP_RETENTION_DAYS" in ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2; exit 2;; esac
mkdir -p -- "$BACKUP_DIR"
BACKUP_DIR="$(cd -- "$BACKUP_DIR" && pwd -P)"
if [[ -z "$BACKUP_DIR" || "$BACKUP_DIR" == "/" ]]; then echo "Refusing unsafe backup directory." >&2; exit 2; fi

DATABASE_NAME="$(psql "$DATABASE_URL" -XAtqc 'SELECT current_database()')"
SERVER_VERSION_NUM="$(psql "$DATABASE_URL" -XAtqc 'SHOW server_version_num')"
CLIENT_MAJOR="$(pg_dump --version | awk '{print $3}' | cut -d. -f1)"
SERVER_MAJOR="$((SERVER_VERSION_NUM / 10000))"
if [[ "$CLIENT_MAJOR" != "$SERVER_MAJOR" ]]; then
  echo "Refusing backup: pg_dump major $CLIENT_MAJOR must match PostgreSQL server major $SERVER_MAJOR." >&2
  exit 6
fi
if [[ -z "$DATABASE_NAME" ]]; then echo "Unable to resolve the source database." >&2; exit 3; fi
SAFE_DATABASE_NAME="$(printf '%s' "$DATABASE_NAME" | tr -c 'A-Za-z0-9_.-' '_')"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_PATH="$BACKUP_DIR/${SAFE_DATABASE_NAME}_${STAMP}.dump"
TEMP_PATH="${FINAL_PATH}.partial"
trap 'rm -f -- "$TEMP_PATH"' EXIT
printf 'Creating PostgreSQL %s backup for database %s\n' "$SERVER_MAJOR" "$DATABASE_NAME"
pg_dump "$DATABASE_URL" --format=custom --compress=9 --no-owner --no-acl --file="$TEMP_PATH"
pg_restore --list "$TEMP_PATH" >/dev/null
mv -- "$TEMP_PATH" "$FINAL_PATH"
sha256sum "$FINAL_PATH" >"${FINAL_PATH}.sha256"
trap - EXIT
if (( BACKUP_RETENTION_DAYS > 0 )); then
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${SAFE_DATABASE_NAME}_*.dump" -o -name "${SAFE_DATABASE_NAME}_*.dump.sha256" \) -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete
fi
printf 'Backup completed: %s\n' "$FINAL_PATH"
printf 'Checksum: %s.sha256\n' "$FINAL_PATH"