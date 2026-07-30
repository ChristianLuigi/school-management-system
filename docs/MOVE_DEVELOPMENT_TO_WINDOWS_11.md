# Move the development environment to another Windows 11 PC

This procedure recreates the application, PostgreSQL data, local environment files,
and uploaded development files on another Windows 11 computer.

## 1. Synchronize the source code

The destination PC receives only code that exists on GitHub. Before moving, commit
and push every source change that should be present on the other PC. Check with:

```powershell
git status
git push
```

If changes must remain uncommitted, securely copy the entire repository working
folder instead of relying only on GitHub. Do not copy `node_modules` or `.next`.

## 2. Create the private transfer bundle

On the current PC, start Docker Desktop and PostgreSQL, then run:

```powershell
docker compose up -d postgres
.\scripts\export-development-environment.ps1 -Destination "E:\school-mgmt-private-transfer"
```

Choose an encrypted USB drive or another secure destination outside the repository.
The generated folder contains a PostgreSQL archive, `.env` files, and uploaded
files. It contains secrets and personal data and must never be committed to Git.

Stop making database changes after the export, or export again immediately before
switching computers.

## 3. Prepare the new PC

Install:

- Git for Windows
- Docker Desktop using Linux containers
- Node.js 20 or newer

Docker Desktop must be running before continuing. Clone the repository:

```powershell
New-Item -ItemType Directory -Force C:\Dev
Set-Location C:\Dev
git clone https://github.com/ChristianLuigi/school-management-system.git
Set-Location .\school-management-system
```

Copy the private transfer bundle to the new PC, but keep it outside the repository.

## 4. Restore everything

From an ordinary PowerShell window in the cloned repository:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-development-pc.ps1 -BundlePath "E:\school-mgmt-private-transfer"
```

The setup installs locked dependencies, starts PostgreSQL 16, restores the database,
copies local environment files, and restores uploads. Restoring intentionally
replaces the new PC's empty development database.

## 5. Start and verify

Open two PowerShell windows in the repository:

```powershell
pnpm dev:api
```

```powershell
pnpm dev:web
```

Open `http://localhost:3000`. The API normally listens on
`http://localhost:4000`.

After confirming that logins, records, and uploads work, securely erase the private
transfer bundle from any unencrypted temporary location. Keep the original PC
unchanged until the new environment has been verified.

