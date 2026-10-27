$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is not running. Open Docker Desktop, wait for the engine, then retry.'
}

Set-Location $projectRoot
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not be started.' }

Write-Host 'Waiting for PostgreSQL...'
for ($attempt = 1; $attempt -le 30; $attempt++) {
    $containerId = docker compose ps -q postgres
    $status = if ($containerId) { docker inspect --format='{{.State.Health.Status}}' $containerId 2>$null } else { '' }
    if ($status -eq 'healthy') {
        Write-Host 'PostgreSQL is ready on localhost:5432.'
        exit 0
    }
    Start-Sleep -Seconds 1
}
throw 'PostgreSQL did not become healthy within 30 seconds.'
