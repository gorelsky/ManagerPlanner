param(
  [string]$DumpPath = "$PSScriptRoot\..\.local\backups\supabase-before-yandex-20260924.dump",
  [string]$HostName = "rc1b-qcnd5806atkojaop.mdb.yandexcloud.net",
  [int]$Port = 6432,
  [string]$Database = "managerplanner",
  [string]$User = "user1",
  [string]$CaFile = "$PSScriptRoot\..\.local\certs\yandex-postgresql-ca.pem"
)

$ErrorActionPreference = "Stop"
$pgRestore = Join-Path $PSScriptRoot "..\.local\tools\pg17\pg_restore.exe"

if (-not (Test-Path -LiteralPath $DumpPath -PathType Leaf)) {
  throw "Dump not found: $DumpPath"
}
if (-not (Test-Path -LiteralPath $pgRestore -PathType Leaf)) {
  throw "pg_restore not found: $pgRestore"
}

if (-not $env:YANDEX_PG_PASSWORD) {
  $secure = Read-Host "Enter Yandex PostgreSQL password" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:YANDEX_PG_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$env:PGPASSWORD = $env:YANDEX_PG_PASSWORD
$args = @(
  "--host=$HostName", "--port=$Port", "--username=$User", "--dbname=$Database",
  "--no-owner", "--no-privileges", "--exit-on-error", "--verbose"
)
if (Test-Path -LiteralPath $CaFile -PathType Leaf) {
  # pg_restore does not expose libpq SSL options as command-line switches.
  # Pass them through libpq environment variables instead.
  $env:PGSSLROOTCERT = (Resolve-Path -LiteralPath $CaFile).Path
  $env:PGSSLMODE = "verify-full"
}
$args += $DumpPath

& $pgRestore @args
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
Write-Output "Yandex PostgreSQL restore completed successfully."
