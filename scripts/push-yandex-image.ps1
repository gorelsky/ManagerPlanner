param(
  [Parameter(Mandatory = $true)]
  [string]$Registry,
  [string]$Image = "managerplanner:latest",
  [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$target = "$Registry/managerplanner:$Tag"
docker tag $Image $target
if ($LASTEXITCODE -ne 0) { throw "Docker tag failed" }
docker push $target
if ($LASTEXITCODE -ne 0) { throw "Docker push failed" }
Write-Output "Pushed image: $target"
