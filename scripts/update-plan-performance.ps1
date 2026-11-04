$ErrorActionPreference = "Stop"

# Keep Russian paths, messages and errors readable in Windows PowerShell.
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceFile = $env:PLAN_SOURCE_FILE

$apiUrl = if ($env:PLAN_IMPORT_API_URL) { $env:PLAN_IMPORT_API_URL } else { "https://managerplanner.up.railway.app" }
$tokenFile = Join-Path $scriptDir "plan-import-token.txt"
$logFile = Join-Path $scriptDir "plan-performance-import.log"
$token = $env:PLAN_IMPORT_TOKEN
if (-not $token -and (Test-Path -LiteralPath $tokenFile -PathType Leaf)) { $token = (Get-Content -LiteralPath $tokenFile -Raw).Trim() }

function Write-ImportLog([string]$message) {
  Add-Content -LiteralPath $logFile -Value ("[{0}] {1}" -f (Get-Date -Format "dd.MM.yyyy HH:mm:ss"), $message)
}

if (-not $token) {
  Write-ImportLog "ERROR: PLAN_IMPORT_TOKEN is missing."
  Write-Host "PLAN_IMPORT_TOKEN is missing. Create $tokenFile"
  exit 2
}
if (-not $sourceFile) {
  Write-ImportLog "ERROR: PLAN_SOURCE_FILE is required; automatic first-match selection is disabled."
  Write-Host "Set PLAN_SOURCE_FILE to the exact workbook path; no file was selected."
  exit 3
}
if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
  Write-ImportLog "ERROR: source workbook does not exist: $sourceFile"
  Write-Host "Source workbook not found: $sourceFile"
  exit 3
}
$source = Get-Item -LiteralPath $sourceFile
$maxAgeDays = if ($env:PLAN_SOURCE_MAX_AGE_DAYS) { [int]$env:PLAN_SOURCE_MAX_AGE_DAYS } else { 30 }
if ($maxAgeDays -lt 0 -or $source.LastWriteTime -lt (Get-Date).AddDays(-$maxAgeDays)) {
  Write-ImportLog ("ERROR: source workbook is older than {0} days: {1}" -f $maxAgeDays, $source.LastWriteTime)
  Write-Host ("Source workbook is stale (modified {0}); refresh it or set PLAN_SOURCE_MAX_AGE_DAYS deliberately." -f $source.LastWriteTime)
  exit 4
}

Write-ImportLog "Starting source workbook upload: $sourceFile"
try {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & node (Join-Path $scriptDir "upload-plan-performance.mjs") $sourceFile $apiUrl $token 2>&1 | ForEach-Object {
    Write-ImportLog ([string]$_)
    Write-Host $_
  }
  $nodeExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($nodeExitCode -ne 0) {
    Write-ImportLog "Upload failed with exit code $nodeExitCode."
    exit 1
  }
} catch {
  Write-ImportLog ("Upload failed: " + $_.Exception.Message)
  Write-Host $_.Exception.Message
  exit 1
}

Write-ImportLog "Upload completed successfully."
Write-Host "Sales data updated. Log: $logFile"
exit 0
