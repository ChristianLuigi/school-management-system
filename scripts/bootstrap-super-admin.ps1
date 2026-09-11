$ErrorActionPreference = "Stop"

function ConvertTo-PlainText {
  param([Security.SecureString]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$requiredConfirmation = "CREATE_INITIAL_SUPER_ADMIN"
$confirmation = Read-Host "Type $requiredConfirmation to continue"
if ($confirmation -cne $requiredConfirmation) {
  throw "Bootstrap cancelled: confirmation did not match."
}

$email = Read-Host "Super Admin email"
$firstName = Read-Host "First name"
$lastName = Read-Host "Last name"
$password = Read-Host "New password (15+ characters)" -AsSecureString
$databaseUrl = Read-Host "Neon direct DATABASE_URL" -AsSecureString

try {
  $env:BOOTSTRAP_SUPER_ADMIN_CONFIRMATION = $confirmation
  $env:BOOTSTRAP_SUPER_ADMIN_EMAIL = $email
  $env:BOOTSTRAP_SUPER_ADMIN_FIRST_NAME = $firstName
  $env:BOOTSTRAP_SUPER_ADMIN_LAST_NAME = $lastName
  $env:BOOTSTRAP_SUPER_ADMIN_PASSWORD = ConvertTo-PlainText $password
  $env:DATABASE_URL = ConvertTo-PlainText $databaseUrl
  $env:DATABASE_SSL = "true"
  $env:DATABASE_SSL_REJECT_UNAUTHORIZED = "true"

  Push-Location (Join-Path $PSScriptRoot "..")
  try {
    & pnpm --dir apps/api admin:bootstrap
    if ($LASTEXITCODE -ne 0) {
      throw "Super Admin bootstrap failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  Remove-Item Env:BOOTSTRAP_SUPER_ADMIN_CONFIRMATION -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_SUPER_ADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_SUPER_ADMIN_FIRST_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_SUPER_ADMIN_LAST_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_SUPER_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_SSL -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_SSL_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
}
