# Run unmerged repository changes in the dedicated CI Docker environment, without Azure login.
$ErrorActionPreference='Stop'
. "$PSScriptRoot/../policy.ps1"
$root=(Resolve-Path "$PSScriptRoot/../../..").Path
$compose=Join-Path $PSScriptRoot 'compose.yaml'
$id=[guid]::NewGuid().ToString('N')
$container="cinnai-ci-check-$id"
$workspace="/home/jenkins/agent/local-check-$id"
$report=Join-Path $root ".test-tmp/local-ci-$id"
New-Item -ItemType Directory -Force $report | Out-Null
if (!(Test-Path "$PSScriptRoot/secrets/admin-password") -or !(Test-Path "$PSScriptRoot/secrets/agent-secret")) {
 throw 'First create local secret files using set-secret.ps1 as described in local/README.md. No Azure credentials are needed.'
}
Push-Location $root
$created=$false
try {
 # Do not change the existing user's checkout. Exclude all local secrets/state/cache.
 $files=@(git ls-files --cached --others --exclude-standard)
 if ($LASTEXITCODE -ne 0) {throw 'Cannot enumerate repository files'}
 $files=@($files | Where-Object {
  (Test-Path -LiteralPath $_ -PathType Leaf) -and
  $_ -notmatch '(^|/)(\.env[^/]*|secrets|node_modules|\.venv|\.terraform|\.test-tmp)(/|$)' -and
  $_ -notmatch '\.(tfstate|tfplan|tfvars|pem|pfx|key)(\.|$)' -and
  $_ -notmatch '(\.backend\.hcl|credentials[^/]*\.json)$'
 })
 $list=Join-Path $report 'files.txt'
 $archive=Join-Path $report 'source.tar'
 [IO.File]::WriteAllLines($list,$files,[Text.UTF8Encoding]::new($false))
 Invoke-Checked tar @('-cf',$archive,'-T',$list)
 Invoke-Checked docker @('compose','-f',$compose,'--profile','agent','build','agent')
 Invoke-Checked docker @('compose','-f',$compose,'up','-d','init-work','docker')
 Invoke-Checked docker @('compose','-f',$compose,'--profile','agent','run','-d','--no-deps','--name',$container,'--entrypoint','sleep','agent','infinity')
 $created=$true
 Invoke-Checked docker @('cp',$archive,"${container}:/tmp/source.tar")
 # The only target is this invocation's UUID directory in the CI-owned volume.
 Invoke-Checked docker @('exec','--user','0',$container,'sh','-c',"mkdir -p '$workspace' && tar -xf /tmp/source.tar -C '$workspace' && chown -R 1000:1000 '$workspace'")
 Invoke-Checked docker @('exec','--workdir',$workspace,$container,'sh','-c','git init -q && git config user.name LocalValidation && git config user.email local@example.invalid && git add . && git commit -qm "Local validation snapshot"')
 # Wait for TLS daemon; no host socket is used by the helper.
 $ready=$false
 for ($i=0;$i -lt 60;$i++) {
  docker exec $container docker info *> $null
  if ($LASTEXITCODE -eq 0) {$ready=$true;break}
  Start-Sleep 2
 }
 if (!$ready) {throw 'CI Docker daemon did not become ready'}
 Invoke-Checked docker @('exec','--workdir',$workspace,$container,'pwsh','-NoProfile','-File','infrastructure/jenkins/validate.ps1')
 Invoke-Checked docker @('exec','--workdir',$workspace,$container,'pwsh','-NoProfile','-File','infrastructure/jenkins/cleanup-cache.ps1')
 'PASS' | Set-Content (Join-Path $report 'status.txt')
} catch {
 'FAIL: '+$_.Exception.Message | Set-Content (Join-Path $report 'status.txt')
 throw
} finally {
 try {
  if ($created) {
   try {
    # Docker reports successful copies on stderr in Windows PowerShell 5.1.
    # Judge success by exit code, and always attempt this run's helper cleanup.
    Invoke-Checked docker @('cp',"${container}:${workspace}/.ci-reports",$report)
   } finally {
    Invoke-Checked docker @('rm','-f',$container) | Out-Null
   }
  }
 } finally {
  Pop-Location
  Write-Host "Local CI report: $report"
  Write-Host "Validation checkout retained in CI volume: $workspace"
 }
}
