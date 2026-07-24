[CmdletBinding()]
param(
  [string]$RestoreDatabaseUrl = $env:RESTORE_DATABASE_URL,
  [string]$BackupFile = $env:BACKUP_FILE,
  [string]$ConfirmDatabase = $env:CONFIRM_RESTORE_DATABASE,
  [switch]$AllowProductionRestore,
  [string]$PostgresToolsDirectory = $env:POSTGRES_TOOLS_DIRECTORY
)
$ErrorActionPreference = 'Stop'
function Get-PgTool([string]$Name) { if ($PostgresToolsDirectory) { return (Join-Path $PostgresToolsDirectory "$Name.exe") }; return $Name }
if (-not $RestoreDatabaseUrl) { throw 'RESTORE_DATABASE_URL or -RestoreDatabaseUrl is required.' }
if (-not $BackupFile -or -not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw 'A valid BACKUP_FILE or -BackupFile is required.' }
$psql = Get-PgTool 'psql'; $pgRestore = Get-PgTool 'pg_restore'; $resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$targetDatabase = (& $psql $RestoreDatabaseUrl -X -A -t -q -c 'SELECT current_database()').Trim()
$serverVersionNumber = [int](& $psql $RestoreDatabaseUrl -X -A -t -q -c 'SHOW server_version_num').Trim()
$clientVersion = (& $pgRestore --version) -join ' '
if ($clientVersion -notmatch '(\d+)(?:\.\d+)?') { throw 'Unable to determine pg_restore version.' }
$clientMajor = [int]$Matches[1]; $serverMajor = [math]::Floor($serverVersionNumber / 10000)
if ($clientMajor -ne $serverMajor) { throw "Refusing restore: pg_restore major $clientMajor must match PostgreSQL server major $serverMajor." }
if ($LASTEXITCODE -ne 0 -or -not $targetDatabase) { throw 'Unable to resolve the restore target database.' }
if ($targetDatabase -notmatch '(?i)(test|drill|restore|scratch)' -and -not $AllowProductionRestore -and $env:ALLOW_PRODUCTION_RESTORE -ne 'YES_I_UNDERSTAND') { throw "Refusing to restore to apparent production database '$targetDatabase'." }
if ($ConfirmDatabase -ne $targetDatabase) { throw "Restore target is '$targetDatabase'. Set -ConfirmDatabase '$targetDatabase' to continue." }
Write-Output "Restore target resolved to database: $targetDatabase"
$checksumPath = "${resolvedBackup}.sha256"
if (Test-Path -LiteralPath $checksumPath) {
  $expected = ((Get-Content -LiteralPath $checksumPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant(); $actual = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw 'Backup checksum verification failed.' }
}
& $pgRestore $resolvedBackup "--dbname=$RestoreDatabaseUrl" --clean --if-exists --exit-on-error --no-owner --no-acl
if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
$result = (& $psql $RestoreDatabaseUrl -X -A -t -q -v ON_ERROR_STOP=1 -c "SELECT 'schema_migrations=' || COUNT(*) FROM schema_migrations;").Trim()
if ($LASTEXITCODE -ne 0) { throw 'Restore consistency check failed.' }
Write-Output $result; Write-Output "Restore completed for $targetDatabase."