param([ValidateSet('deploy','rollback')][string]$Action,[string]$Commit,[string]$Build,[string]$BuildNumber,[hashtable]$Headers)
$ErrorActionPreference='Stop'
$Build=$Build.TrimEnd('/')
if ($env:DOCKER_HOST -or $env:DOCKER_TLS_VERIFY -or $env:DOCKER_CERT_PATH) {throw 'Use local Docker Desktop, not a remote or CI Docker endpoint, for Windows release'}
. "$PSScriptRoot/policy.ps1"
. "$PSScriptRoot/verify-bundle.ps1"
if ((git branch --show-current).Trim() -cne 'main' -or (git rev-parse HEAD).Trim() -cne $Commit) {throw 'Reviewed main checkout required'}
$releaseRoot=Join-Path $env:LOCALAPPDATA 'CinnAI/releases'
$null=New-Item -ItemType Directory -Force $releaseRoot
$lock=$null
$saved=@{}
foreach ($name in @('CINNAI_RELEASE_LEDGER','BRANCH_NAME','VALIDATED_COMMIT','CHANGE_ID','TAG_NAME','DOCKER_CONFIG')) {$saved[$name]=[Environment]::GetEnvironmentVariable($name)}
$privateDocker=$null
try {
 $lock=[IO.File]::Open((Join-Path $releaseRoot 'release.lock'),'OpenOrCreate','ReadWrite','None')
 $env:CINNAI_RELEASE_LEDGER=Join-Path $releaseRoot 'ledger.json'
 $env:BRANCH_NAME='main';$env:VALIDATED_COMMIT=$Commit;$env:CHANGE_ID='';$env:TAG_NAME=''
 if ($Action -eq 'deploy') {
  $bundle=Join-Path $releaseRoot ([guid]::NewGuid().ToString('N'))
  $null=New-Item -ItemType Directory $bundle
  $manifest=Join-Path $bundle 'manifest.json'
  $archive=Join-Path $bundle 'image.tar'
  Invoke-WebRequest "$Build/artifact/release-bundle/manifest.json" -Headers $Headers -OutFile $manifest -UseBasicParsing -MaximumRedirection 0
  Invoke-WebRequest "$Build/artifact/release-bundle/image.tar" -Headers $Headers -OutFile $archive -UseBasicParsing -MaximumRedirection 0
  $m=Assert-ReleaseBundle $manifest $archive $Commit $BuildNumber
  $identities=python "$PSScriptRoot/archive_identity.py" $archive $m.image_id
  if ($LASTEXITCODE -ne 0) {throw 'Archive identity verification failed; Python 3 is required'}
  $allowed=@($identities | ConvertFrom-Json)
  Invoke-Checked docker @('load','--input',$archive)
  $loaded=$null
  foreach ($candidate in $allowed) {
   try {
    $ErrorActionPreference='Continue'
    $inspection=docker image inspect $candidate --format '{{.Id}}' 2>$null
    $inspectExit=$LASTEXITCODE
   } finally {$ErrorActionPreference='Stop'}
   if ($inspectExit -eq 0 -and "$inspection".Trim() -ceq $candidate) {$loaded=$candidate;break}
  }
  if (!$loaded) {throw 'No loaded image matches the verified archive identities'}
  $platform=(docker image inspect $loaded --format '{{.Os}}/{{.Architecture}}').Trim()
  if ($LASTEXITCODE -ne 0 -or $platform -cne 'linux/amd64') {throw 'Expected Linux/amd64 image'}
  $loaded | Set-Content .ci-tested-image.txt
 }
 if ((Read-Host "Type RELEASE $Commit to approve Azure $Action") -cne "RELEASE $Commit") {throw 'Release not approved; Azure unchanged'}
 $privateDocker=Join-Path $releaseRoot ([guid]::NewGuid().ToString('N'))
 $null=New-Item -ItemType Directory $privateDocker
 # Windows ACL protects the short-lived registry credential. Azure's personal cache stays on Windows.
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 Invoke-Checked icacls @($privateDocker,'/inheritance:r','/grant:r',"*${sid}:(OI)(CI)F",'*S-1-5-18:(OI)(CI)F')
 $env:DOCKER_CONFIG=$privateDocker
 & "$PSScriptRoot/image-release.ps1" -Action $Action
 Get-Content release-result.json -Raw | Write-Host
} finally {
 if ($privateDocker) {
  $resolved=[IO.Path]::GetFullPath($privateDocker)
  if ($resolved.StartsWith([IO.Path]::GetFullPath($releaseRoot)+[IO.Path]::DirectorySeparatorChar) -and (Split-Path $resolved -Leaf) -match '^[a-f0-9]{32}$') {Remove-Item -LiteralPath $resolved -Recurse -Force}
 }
 foreach ($name in $saved.Keys) {[Environment]::SetEnvironmentVariable($name,$saved[$name])}
 if ($lock) {$lock.Dispose()}
}
