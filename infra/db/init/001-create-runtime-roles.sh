#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${APP_DATABASE_USER:?APP_DATABASE_USER is required}"
: "${APP_DATABASE_PASSWORD:?APP_DATABASE_PASSWORD is required}"
: "${MIGRATION_DATABASE_USER:?MIGRATION_DATABASE_USER is required}"
: "${MIGRATION_DATABASE_PASSWORD:?MIGRATION_DATABASE_PASSWORD is required}"

for role_name in "$APP_DATABASE_USER" "$MIGRATION_DATABASE_USER"; do
  if [[ ! "$role_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "Database role names must contain only letters, digits, and underscores and must not start with a digit." >&2
    exit 2
  fi
done
if [[ "$APP_DATABASE_USER" == "$MIGRATION_DATABASE_USER" || "$APP_DATABASE_USER" == "$POSTGRES_USER" || "$MIGRATION_DATABASE_USER" == "$POSTGRES_USER" ]]; then
  echo "Bootstrap, migration, and application database roles must be distinct." >&2
  exit 3
fi

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=app_user="$APP_DATABASE_USER" \
  --set=app_password="$APP_DATABASE_PASSWORD" \
  --set=migration_user="$MIGRATION_DATABASE_USER" \
  --set=migration_password="$MIGRATION_DATABASE_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'migration_user', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migration_user')
\gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'migration_user')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user')
\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')
\gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'migration_user', :'app_user')
\gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', :'migration_user', :'app_user')
\gexec
SQL