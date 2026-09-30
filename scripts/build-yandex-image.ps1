param(
  [string]$Image = "managerplanner:latest"
)

$ErrorActionPreference = "Stop"
docker build --pull -t $Image (Resolve-Path (Join-Path $PSScriptRoot ".."))
if ($LASTEXITCODE -ne 0) { throw "Docker image build failed" }
Write-Output "Built image: $Image"
