# ADR: Legacy migration canonicalization

- Status: Accepted locally; deployed-installation verification required
- Date: 2026-07-24
- Affected files: `002_core_tables.sql`, `019_backfill_school_levels.sql`

## Evidence

The parent Git history is the only configured local release source. No parent or API remote was configured when this review began. The available development database has no `schema_migrations` table, so it predates checksum tracking. It contains the expected `users`, `schools`, `school_levels`, and later security/operational-access schema.

The historical `002_core_tables.sql` created `users` twice with the same unguarded `CREATE TABLE` statement. PostgreSQL therefore could not execute that file successfully as one migration on a clean database. The canonical repair removes only the duplicate second definition and leaves the first definition and trigger intact.

The historical `019_backfill_school_levels.sql` inserted fixed demo-school rows without first establishing that the referenced demo school existed. It therefore violated the foreign key on installations without that seed school. The canonical repair selects the fixed rows only when the referenced school exists; installations containing the demo school receive the same three rows and grade-level links as before.

These repairs predate adoption of the checksum-backed migration runner and are necessary for the historical chain to create a clean database. Migration filenames and ordering did not change.

## Decision

The repaired files are the canonical source for fresh installations and for baselining a verified pre-checksum installation. Migration checksums use canonical LF line endings so identity is stable across Windows, Linux CI, and production containers. `.gitattributes` also enforces LF for SQL migrations.

This decision does not authorize rewriting an installation that already has a checksum recorded for either filename.

Canonical SHA-256 values:

- `002_core_tables.sql`: `10b4c5cbf58fd40d962e70e0d53c8300a662e5e6228934c6c3b53c0268a2e7e9`
- `019_backfill_school_levels.sql`: `213f0fee0e67267dfbcd383967eb872bd692b278b4a5262f66c5f94d4e029061`

## Existing-installation procedure

1. Capture and restore-verify a database backup.
2. Record the exact deployed application commit, image digest, and copies/checksums of migrations `002` and `019`.
3. Query `schema_migrations` if it exists.
4. If either filename is recorded with a checksum different from the release candidate, stop and investigate. Do not update the row and do not use `baseline`.
5. If `schema_migrations` is absent, compare the existing schema with a disposable database built from the candidate migrations.
6. Only after the schema contract is verified, run the explicit baseline procedure through `058_operational_user_access.sql`, apply pending migrations, and run checksum verification.
7. Retain the comparison, backup, restore drill, and command outputs as release evidence.

## Remaining gate

No deployed or staging database/release source was available during the local canonicalization review. The release owner must complete the existing-installation procedure against the actual staging predecessor before approving a pilot. Until then, upgrade compatibility is an open P0 release gate even though clean-database migration tests pass.
