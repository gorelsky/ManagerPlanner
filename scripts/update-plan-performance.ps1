$ErrorActionPreference = "Stop"

# Keep Russian paths, messages and errors readable in Windows PowerShell.
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$d = [char]0x0414
$v = [char]0x0412
$m = [char]0x041C
$p = [char]0x041F
$two = "2"
$dataRoot = Get-ChildItem -LiteralPath "D:\" -Directory | Where-Object { $_.Name -like "$d*$m$p" } | Select-Object -First 1
$inputRoot = if ($dataRoot) { Get-ChildItem -LiteralPath $dataRoot.FullName -Directory | Where-Object { $_.Name -like "$v*" } | Select-Object -First 1 }
$defaultSource = if ($inputRoot) {
  (Get-ChildItem -LiteralPath $inputRoot.FullName -File | Where-Object { $_.Name -like "$d*$m$p$two.xlsx" } | Select-Object -First 1).FullName
}
$sourceFile = if ($env:PLAN_SOURCE_FILE) { $env:PLAN_SOURCE_FILE } else { $defaultSource }

if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
  $fallbacks = if ($inputRoot) {
    @(
      (Get-ChildItem -LiteralPath $inputRoot.FullName -File | Where-Object { $_.Name -like "$d*$m$p$two.xlsx" } | Select-Object -First 1).FullName,
      (Get-ChildItem -LiteralPath $inputRoot.FullName -File | Where-Object { $_.Name -eq "plan-performance.xlsx" } | Select-Object -First 1).FullName
    )
  }
  $sourceFile = $fallbacks | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

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
  Write-ImportLog "ERROR: source workbook not found."
  Write-Host "Source workbook not found in D:\data input folder"
  exit 3
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
