param(
  [Parameter(Mandatory = $true)]
  [string]$FolderPath,

  [Parameter(Mandatory = $true)]
  [string]$ApiUrl,

  [Parameter(Mandatory = $true)]
  [string]$ImportToken,

  [string]$FileName = "plan-performance.xlsx"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FolderPath -PathType Container)) {
  throw "Folder not found: $FolderPath"
}

$filePath = Join-Path -Path $FolderPath -ChildPath $FileName
$file = Get-Item -LiteralPath $filePath -ErrorAction SilentlyContinue

if (-not $file -or $file.PSIsContainer) {
  throw "Import file not found: $filePath"
}

$bytes = [System.IO.File]::ReadAllBytes($file.FullName)
$payload = @{
  fileName = $file.Name
  fileBase64 = [Convert]::ToBase64String($bytes)
} | ConvertTo-Json -Compress

$headers = @{
  "Content-Type" = "application/json"
  "X-Plan-Import-Token" = $ImportToken
}

$response = Invoke-RestMethod `
  -Uri "$($ApiUrl.TrimEnd('/'))/api/plan-performance/import-file" `
  -Method Post `
  -Headers $headers `
  -Body $payload

Write-Output "Imported file $($response.fileName): $($response.imported) rows"
