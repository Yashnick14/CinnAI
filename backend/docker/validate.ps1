param([string]$OutputDirectory = (Join-Path $env:TEMP ("cinnai-docker-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))))
$ErrorActionPreference = 'Stop'
$backend = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
function Invoke-Docker([string[]]$Arguments) {
    # Windows PowerShell 5.1 wraps native stderr as ErrorRecord, even on exit 0.
    # Scope this preference to the native invocation; always check its exit code.
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    & docker @Arguments 2>&1 | ForEach-Object { $_.ToString() }
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "Docker failed (exit $code): $($Arguments -join ' ')" }
}
Invoke-Docker @('info', '--format', '{{.OSType}}')
$started = Get-Date
Invoke-Docker @('build', '--platform', 'linux/amd64', '--target', 'production', '-t', 'cinnai-backend:local', $backend)
Invoke-Docker @('build', '--platform', 'linux/amd64', '--target', 'test', '-t', 'cinnai-backend:test', $backend)
"Build seconds: $(((Get-Date)-$started).TotalSeconds)" | Set-Content (Join-Path $OutputDirectory 'build-time.txt')
Invoke-Docker @('image', 'inspect', 'cinnai-backend:local', '--format', '{{.Size}}') | Set-Content (Join-Path $OutputDirectory 'image-size-bytes.txt')
$common = @('run', '--rm', '--network', 'none', '--cpus', '2', '--memory', '4g', '--read-only',
    '--tmpfs', '/tmp:rw,nosuid,size=1g,mode=1777', '--tmpfs', '/var/lib/cinnai:rw,nosuid,size=1g,mode=1777',
    '--mount', "type=bind,source=$backend/tests,target=/app/tests,readonly",
    '--mount', "type=bind,source=$backend/pytest.ini,target=/app/pytest.ini,readonly",
    '--mount', "type=bind,source=$backend/backend_handoff/FYP.ipynb,target=/app/backend_handoff/FYP.ipynb,readonly",
    '--mount', "type=bind,source=$backend/backend_handoff/test_images,target=/app/backend_handoff/test_images,readonly")
Invoke-Docker ($common + @('cinnai-backend:test')) | Tee-Object (Join-Path $OutputDirectory 'pytest.txt')
Invoke-Docker ($common + @('cinnai-backend:test', 'python', 'docker/smoke.py')) | Tee-Object (Join-Path $OutputDirectory 'inference-and-resources.json')
$name = 'cinnai-health-' + [guid]::NewGuid().ToString('N').Substring(0,8)
try {
    $start = Get-Date
    Invoke-Docker @('run', '-d', '--name', $name, '--cpus', '2', '--memory', '4g', '--read-only',
        '--tmpfs', '/tmp:rw,nosuid,size=1g,mode=1777', '--tmpfs', '/var/lib/cinnai:rw,nosuid,size=1g,mode=1777', 'cinnai-backend:local')
    $healthy = $false
    for ($i=0; $i -lt 90; $i++) {
        $status = Invoke-Docker @('inspect', $name, '--format', '{{.State.Health.Status}}')
        if ($status -eq 'healthy') { $healthy = $true; break }
        if ($status -eq 'unhealthy') { break }
        Start-Sleep -Seconds 2
    }
    if (-not $healthy) { throw 'Container failed health check' }
    "Healthy after $(((Get-Date)-$start).TotalSeconds) seconds (includes probe interval)" | Set-Content (Join-Path $OutputDirectory 'health.txt')
    Invoke-Docker @('stats', '--no-stream', $name) | Set-Content (Join-Path $OutputDirectory 'idle-resources.txt')
} finally {
    try {
        Invoke-Docker @('logs', $name) | Set-Content (Join-Path $OutputDirectory 'startup.txt')
    } finally {
        Invoke-Docker @('rm', '-f', $name) | Out-Null
    }
}
'PASS' | Set-Content (Join-Path $OutputDirectory 'status.txt')
Write-Host "Validation report: $OutputDirectory"
