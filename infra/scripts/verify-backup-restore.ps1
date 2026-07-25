[CmdletBinding()]
param(
  [string]$AdminDatabaseUrl = $env:ADMIN_DATABASE_URL,
  [string]$BackupFile = $env:BACKUP_FILE,
  [string]$PostgresToolsDirectory = $env:POSTGRES_TOOLS_DIRECTORY
)
$ErrorActionPreference = 'Stop'
function Get-PgTool([string]$Name) { if ($PostgresToolsDirectory) { return (Join-Path $PostgresToolsDirectory "$Name.exe") }; return $Name }
if (-not $AdminDatabaseUrl) { throw 'ADMIN_DATABASE_URL or -AdminDatabaseUrl is required.' }
if (-not $BackupFile -or -not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw 'A valid BACKUP_FILE or -BackupFile is required.' }
$createdb = Get-PgTool 'createdb'; $dropdb = Get-PgTool 'dropdb'; $psql = Get-PgTool 'psql'
$targetDatabase = 'backup_restore_drill_' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '_' + $PID
$builder = [System.UriBuilder]::new($AdminDatabaseUrl); $builder.Path = "/$targetDatabase"; $targetUrl = $builder.Uri.AbsoluteUri
try {
  & $createdb "--maintenance-db=$AdminDatabaseUrl" $targetDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Unable to create the disposable restore database.' }
  & (Join-Path $PSScriptRoot 'restore-postgres.ps1') -RestoreDatabaseUrl $targetUrl -BackupFile $BackupFile -ConfirmDatabase $targetDatabase -PostgresToolsDirectory $PostgresToolsDirectory
  $tableCount = (& $psql $targetUrl -X -A -t -q -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
  if ($LASTEXITCODE -ne 0 -or [int]$tableCount -lt 1) { throw 'Restored database contains no public tables.' }
  Write-Output "Disposable restore drill passed for $targetDatabase with $tableCount public tables."
} finally { & $dropdb --if-exists --force "--maintenance-db=$AdminDatabaseUrl" $targetDatabase | Out-Null }