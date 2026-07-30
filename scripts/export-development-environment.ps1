[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [string]$ContainerName = "school_mgmt_pg",
    [string]$DatabaseName = "school_mgmt",
    [string]$DatabaseUser = "school_admin"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$bundleRoot = [System.IO.Path]::GetFullPath($Destination)

New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null

$container = docker ps --filter "name=^/$ContainerName$" --format "{{.Names}}"
if ($container -ne $ContainerName) {
    throw "The PostgreSQL container '$ContainerName' is not running. Run 'docker compose up -d postgres' first."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "school-mgmt-$timestamp.dump"
$containerArchive = "/tmp/$archiveName"
$localArchive = Join-Path $bundleRoot "database.dump"

Write-Host "Exporting PostgreSQL database..."
docker exec $ContainerName pg_dump `
    --format=custom `
    --no-owner `
    --no-privileges `
    --username=$DatabaseUser `
    --file=$containerArchive `
    $DatabaseName
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed."
}

docker cp "${ContainerName}:${containerArchive}" $localArchive
if ($LASTEXITCODE -ne 0) {
    throw "Could not copy the database archive from Docker."
}
docker exec $ContainerName rm -f $containerArchive | Out-Null

$secretFiles = @(
    ".env",
    "apps/api/.env",
    "apps/web/.env.local"
)

foreach ($relativePath in $secretFiles) {
    $source = Join-Path $repositoryRoot $relativePath
    if (Test-Path -LiteralPath $source) {
        $target = Join-Path $bundleRoot $relativePath
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
    }
}

$uploadsRoot = Join-Path $repositoryRoot "apps/web/public/uploads"
if (Test-Path -LiteralPath $uploadsRoot) {
    Compress-Archive -LiteralPath $uploadsRoot -DestinationPath (Join-Path $bundleRoot "uploads.zip") -Force
}

$manifest = [ordered]@{
    createdAt = (Get-Date).ToString("o")
    database = $DatabaseName
    databaseContainer = $ContainerName
    gitCommit = (git -C $repositoryRoot rev-parse HEAD)
    gitBranch = (git -C $repositoryRoot branch --show-current)
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $bundleRoot "manifest.json") -Encoding UTF8

Write-Host ""
Write-Host "Development bundle created at: $bundleRoot"
Write-Warning "This bundle contains database data and secrets. Do not commit it or send it through an insecure channel."

