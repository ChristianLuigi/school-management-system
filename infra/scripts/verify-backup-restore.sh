#!/usr/bin/env bash
set -Eeuo pipefail
: "${ADMIN_DATABASE_URL:?ADMIN_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
if [[ "$ADMIN_DATABASE_URL" != postgresql://* || "$ADMIN_DATABASE_URL" == *'?'* || "$ADMIN_DATABASE_URL" == *'#'* ]]; then
  echo "ADMIN_DATABASE_URL must be a PostgreSQL URL without query or fragment parameters." >&2; exit 2
fi
TARGET_DATABASE="backup_restore_drill_$(date -u +%Y%m%d%H%M%S)_$$"
TARGET_DATABASE_URL="${ADMIN_DATABASE_URL%/*}/${TARGET_DATABASE}"
cleanup() { dropdb --if-exists --force --maintenance-db="$ADMIN_DATABASE_URL" "$TARGET_DATABASE" >/dev/null 2>&1 || true; }
trap cleanup EXIT
createdb --maintenance-db="$ADMIN_DATABASE_URL" "$TARGET_DATABASE"
RESTORE_DATABASE_URL="$TARGET_DATABASE_URL" CONFIRM_RESTORE_DATABASE="$TARGET_DATABASE" BACKUP_FILE="$BACKUP_FILE" "$(dirname "$0")/restore-postgres.sh"
TABLE_COUNT="$(psql "$TARGET_DATABASE_URL" -Xv ON_ERROR_STOP=1 -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")"
if (( TABLE_COUNT < 1 )); then echo "Restored database contains no public tables." >&2; exit 7; fi
printf 'Disposable restore drill passed for %s with %s public tables.\n' "$TARGET_DATABASE" "$TABLE_COUNT"