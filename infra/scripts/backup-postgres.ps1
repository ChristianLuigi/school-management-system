[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDirectory = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { './backups' }),
  [ValidateRange(0, 3650)][int]$RetentionDays = $(if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 }),
  [string]$PostgresToolsDirectory = $env:POSTGRES_TOOLS_DIRECTORY
)
$ErrorActionPreference = 'Stop'
function Get-PgTool([string]$Name) { if ($PostgresToolsDirectory) { return (Join-Path $PostgresToolsDirectory "$Name.exe") }; return $Name }
if (-not $DatabaseUrl) { throw 'DATABASE_URL or -DatabaseUrl is required.' }
$psql = Get-PgTool 'psql'; $pgDump = Get-PgTool 'pg_dump'; $pgRestore = Get-PgTool 'pg_restore'
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$resolvedDirectory = (Resolve-Path -LiteralPath $BackupDirectory).Path
$root = [System.IO.Path]::GetPathRoot($resolvedDirectory)
if (-not $resolvedDirectory -or $resolvedDirectory -eq $root) { throw 'Refusing unsafe backup directory.' }
$databaseName = (& $psql $DatabaseUrl -X -A -t -q -c 'SELECT current_database()').Trim()
$serverVersionNumber = [int](& $psql $DatabaseUrl -X -A -t -q -c 'SHOW server_version_num').Trim()
$clientVersion = (& $pgDump --version) -join ' '
if ($clientVersion -notmatch '(\d+)(?:\.\d+)?') { throw 'Unable to determine pg_dump version.' }
$clientMajor = [int]$Matches[1]; $serverMajor = [math]::Floor($serverVersionNumber / 10000)
if ($clientMajor -ne $serverMajor) { throw "Refusing backup: pg_dump major $clientMajor must match PostgreSQL server major $serverMajor." }
if ($LASTEXITCODE -ne 0 -or -not $databaseName) { throw 'Unable to resolve the source database.' }
$safeName = $databaseName -replace '[^A-Za-z0-9_.-]', '_'; $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$finalPath = Join-Path $resolvedDirectory "${safeName}_${stamp}.dump"; $tempPath = "${finalPath}.partial"
try {
  Write-Output "Creating PostgreSQL $serverMajor backup for database $databaseName"
  & $pgDump $DatabaseUrl --format=custom --compress=9 --no-owner --no-acl "--file=$tempPath"
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
  & $pgRestore --list $tempPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Backup archive validation failed.' }
  Move-Item -LiteralPath $tempPath -Destination $finalPath
  $checksum = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText("${finalPath}.sha256", "$checksum  $([System.IO.Path]::GetFileName($finalPath))`n", [System.Text.UTF8Encoding]::new($false))
} finally { if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force } }
if ($RetentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $resolvedDirectory -File | Where-Object { $_.Name -like "${safeName}_*.dump*" -and $_.LastWriteTime -lt $cutoff } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
}
Write-Output "Backup completed: $finalPath"; Write-Output "Checksum: ${finalPath}.sha256"; $finalPath