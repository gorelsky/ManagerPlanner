param(
  [Parameter(Mandatory = $true)]
  [string]$FolderPath,

  [Parameter(Mandatory = $true)]
  [string]$ApiUrl,

  [Parameter(Mandatory = $true)]
  [string]$ImportToken
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FolderPath -PathType Container)) {
  throw "Папка не найдена: $FolderPath"
}

$file = Get-ChildItem -LiteralPath $FolderPath -File |
  Where-Object { $_.Extension -match "^\.(xlsx|xls|csv)$" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $file) {
  throw "В папке нет CSV/XLS/XLSX-файлов: $FolderPath"
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

Write-Output "Импортирован файл $($response.fileName): $($response.imported) строк"
