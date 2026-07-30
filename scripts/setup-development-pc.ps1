[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath,
    [switch]$SkipDependencyInstall,
    [string]$ContainerName = "school_mgmt_pg",
    [string]$DatabaseName = "school_mgmt",
    [string]$DatabaseUser = "school_admin"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$bundleRoot = [System.IO.Path]::GetFullPath($BundlePath)

function Assert-Command {
    param([string]$Name, [string]$InstallHint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' was not found. $InstallHint"
    }
}

Assert-Command "git" "Install Git for Windows, then reopen PowerShell."
Assert-Command "docker" "Install and start Docker Desktop, then reopen PowerShell."
Assert-Command "node" "Install Node.js 20 or newer, then reopen PowerShell."
Assert-Command "corepack" "Install a Node.js distribution that includes Corepack."

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) {
    throw "Node.js 20 or newer is required. Found $(node --version)."
}
if (-not (Test-Path -LiteralPath (Join-Path $bundleRoot "database.dump"))) {
    throw "The bundle does not contain database.dump."
}

Write-Host "Activating pnpm 10.33.0..."
corepack prepare pnpm@10.33.0 --activate
if ($LASTEXITCODE -ne 0) {
    throw "Could not activate pnpm."
}

if (-not $SkipDependencyInstall) {
    Write-Host "Installing API dependencies..."
    pnpm --dir (Join-Path $repositoryRoot "apps/api") install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "API dependency installation failed." }

    Write-Host "Installing web dependencies..."
    pnpm --dir (Join-Path $repositoryRoot "apps/web") install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "Web dependency installation failed." }

    $legacyApp = Join-Path $repositoryRoot "typescript-starter-master"
    if (Test-Path -LiteralPath (Join-Path $legacyApp "package-lock.json")) {
        Write-Host "Installing legacy application dependencies..."
        npm --prefix $legacyApp ci
        if ($LASTEXITCODE -ne 0) { throw "Legacy dependency installation failed." }
    }
}

$secretFiles = @(
    ".env",
    "apps/api/.env",
    "apps/web/.env.local"
)
foreach ($relativePath in $secretFiles) {
    $source = Join-Path $bundleRoot $relativePath
    if (Test-Path -LiteralPath $source) {
        $target = Join-Path $repositoryRoot $relativePath
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
    }
}

Write-Host "Starting PostgreSQL..."
docker compose --file (Join-Path $repositoryRoot "docker-compose.yml") up -d postgres
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose could not start PostgreSQL."
}

$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    docker exec $ContainerName pg_isready --username=$DatabaseUser --dbname=$DatabaseName *> $null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    throw "PostgreSQL did not become ready within 60 seconds."
}

$containerArchive = "/tmp/school-mgmt-restore.dump"
docker cp (Join-Path $bundleRoot "database.dump") "${ContainerName}:${containerArchive}"
if ($LASTEXITCODE -ne 0) { throw "Could not copy the database archive into Docker." }

Write-Host "Restoring the development database..."
docker exec $ContainerName pg_restore `
    --clean `
    --if-exists `
    --no-owner `
    --no-privileges `
    --exit-on-error `
    --username=$DatabaseUser `
    --dbname=$DatabaseName `
    $containerArchive
if ($LASTEXITCODE -ne 0) {
    throw "Database restore failed."
}
docker exec $ContainerName rm -f $containerArchive | Out-Null

$uploadsArchive = Join-Path $bundleRoot "uploads.zip"
if (Test-Path -LiteralPath $uploadsArchive) {
    $publicRoot = Join-Path $repositoryRoot "apps/web/public"
    New-Item -ItemType Directory -Force -Path $publicRoot | Out-Null
    Expand-Archive -LiteralPath $uploadsArchive -DestinationPath $publicRoot -Force
}

Write-Host ""
Write-Host "Setup completed."
Write-Host "Start the API: pnpm dev:api"
Write-Host "Start the web app in another PowerShell window: pnpm dev:web"

