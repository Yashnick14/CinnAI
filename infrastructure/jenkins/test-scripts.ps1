$ErrorActionPreference='Stop'
& "$PSScriptRoot/test-baseline.ps1"
$repo=(Resolve-Path "$PSScriptRoot/../..").Path
$release=Join-Path $PSScriptRoot 'image-release.ps1'
$testRoot=Join-Path (Join-Path $repo '.test-tmp') ('cinnai-script-tests-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory "$testRoot/work"
$saved=@{}
foreach ($key in @('BRANCH_NAME','CHANGE_ID','TAG_NAME','VALIDATED_COMMIT','CINNAI_RELEASE_LEDGER','DOCKER_HOST','DOCKER_TLS_VERIFY')) {$saved[$key]=[Environment]::GetEnvironmentVariable($key)}
$global:cinnaiTest_testSha='a'*40
$global:cinnaiTest_old='cinnai666a84.azurecr.io/backend@sha256:'+('b'*64)
$global:cinnaiTest_new='cinnai666a84.azurecr.io/backend@sha256:'+('c'*64)
$global:cinnaiTest_image=$global:cinnaiTest_old
$global:cinnaiTest_updates=0
$global:cinnaiTest_failNew=$false
$global:cinnaiTest_checks=0
function Assert-Test($ok,$message) {if (!$ok) {throw $message};$global:cinnaiTest_checks++}
# All external commands are replaced; these tests cannot contact Azure or Docker.
function git { $global:LASTEXITCODE=0; if ($args[0] -eq 'ls-remote') {return "$global:cinnaiTest_testSha`trefs/heads/main"};return $global:cinnaiTest_testSha }
function docker { $global:LASTEXITCODE=0 }
function az {
 $global:LASTEXITCODE=0
 if ($args[0] -eq 'account') {return '666a8489-014b-456e-8d3a-3b531503b1b3'}
 if ($args[0] -eq 'acr') {if ($args[1] -eq 'repository') {return 'sha256:'+('c'*64)};return}
 if ($args[0] -eq 'containerapp' -and $args[1] -eq 'update') {
  $global:cinnaiTest_image=$args[[Array]::IndexOf($args,'--image')+1];$global:cinnaiTest_updates++;return
 }
 if ($args[0] -eq 'containerapp' -and $args[1] -eq 'show') {
  return (@{properties=@{latestRevisionName='revision';latestReadyRevisionName='revision';template=@{containers=@(@{image=$global:cinnaiTest_image})};configuration=@{activeRevisionsMode='Single';ingress=@{fqdn='example.invalid'}}}} | ConvertTo-Json -Depth 8)
 }
 throw 'Unexpected mocked Azure operation'
}
function Invoke-RestMethod {if ($global:cinnaiTest_failNew -and $global:cinnaiTest_image -eq $global:cinnaiTest_new) {throw 'unhealthy'};return @{status='ok'}}
function Start-Sleep {}
try {
 Push-Location "$testRoot/work"
 $env:BRANCH_NAME='main';$env:CHANGE_ID='';$env:TAG_NAME='';$env:VALIDATED_COMMIT=$global:cinnaiTest_testSha
 $env:CINNAI_RELEASE_LEDGER="$testRoot/ledger.json"
 ('sha256:'+('d'*64)) | Set-Content .ci-tested-image.txt
 & $release -Action deploy
 Assert-Test ($global:cinnaiTest_image -eq $global:cinnaiTest_new -and $global:cinnaiTest_updates -eq 1) 'Deploy must update only the tested digest'
 $result=Get-Content release-result.json -Raw | ConvertFrom-Json
 Assert-Test ($result.image -eq $global:cinnaiTest_new -and $result.url -eq 'https://example.invalid') 'Release health artifact missing'
 & $release -Action rollback
 Assert-Test ($global:cinnaiTest_image -eq $global:cinnaiTest_old) 'Rollback must restore previous immutable image'
 $global:cinnaiTest_failNew=$true
 $caught=$false
 try {& $release -Action deploy} catch {$caught=$true}
 Assert-Test ($caught -and $global:cinnaiTest_image -eq $global:cinnaiTest_old) 'Failed health must fail release and restore baseline'
 $global:cinnaiTest_failNew=$false
 $env:BRANCH_NAME='Development';$count=$global:cinnaiTest_updates;$caught=$false
 try {& $release -Action deploy} catch {$caught=$true}
 Assert-Test ($caught -and $global:cinnaiTest_updates -eq $count) 'Development must never update app'
 $env:BRANCH_NAME='main';$env:VALIDATED_COMMIT='e'*40;$caught=$false
 try {& $release -Action deploy} catch {$caught=$true}
 Assert-Test ($caught -and $global:cinnaiTest_updates -eq $count) 'Untested commit must never update app'
 $env:DOCKER_HOST='';$env:DOCKER_TLS_VERIFY='';$caught=$false
 try {& "$PSScriptRoot/cleanup-cache.ps1"} catch {$caught=$true}
 Assert-Test $caught 'Cleanup must refuse host Docker'
 function FailedNative { $global:LASTEXITCODE=7 }
 $caught=$false
 try {Invoke-Checked FailedNative @()} catch {$caught=$true}
 Assert-Test $caught 'Native nonzero exit must fail validation'
 $global:LASTEXITCODE=0
 $caught=$false
 try {Invoke-Checked cinnai_nonexistent_command_917 @()} catch {$caught=$true}
 Assert-Test $caught 'Missing tools must fail validation'
 $compose=Get-Content "$repo/infrastructure/jenkins/local/compose.yaml" -Raw
 Assert-Test (!$compose.Contains('docker.sock') -and $compose.Contains('127.0.0.1:8080:8080')) 'Controller socket/port isolation regressed'
 . "$PSScriptRoot/verify-bundle.ps1"
 'image test bytes' | Set-Content image.tar
 $manifest=@{schema=1;commit=$global:cinnaiTest_testSha;image_id=('sha256:'+('d'*64));archive_sha256=(Get-FileHash image.tar).Hash.ToLower();build_number='42';tests_passed=$true}
 $manifest | ConvertTo-Json | Set-Content manifest.json
 $verified=Assert-ReleaseBundle manifest.json image.tar $global:cinnaiTest_testSha '42'
 Assert-Test ($verified.image_id -eq $manifest.image_id) 'Valid bundle rejected'
 foreach ($case in @('commit','build','hash','tests')) {
  $copy=$manifest.Clone()
  switch ($case) {'commit' {$copy.commit='f'*40};'build' {$copy.build_number='43'};'hash' {$copy.archive_sha256='e'*64};'tests' {$copy.tests_passed=$false}}
  $copy | ConvertTo-Json | Set-Content manifest.json
  $caught=$false
  try {Assert-ReleaseBundle manifest.json image.tar $global:cinnaiTest_testSha '42'} catch {$caught=$true}
  Assert-Test $caught "Unsafe bundle accepted: $case"
 }
 $pipeline=Get-Content "$repo/Jenkinsfile.release" -Raw
 Assert-Test (!$pipeline.Contains('AZURE_CERTIFICATE') -and !$pipeline.Contains('az login') -and !$pipeline.Contains('image-release.ps1')) 'Jenkins must not authenticate/deploy to Azure'
 Assert-Test ($pipeline.Contains('export-image.ps1') -and $pipeline.Contains('validate.ps1')) 'Jenkins validation/export missing'
 foreach ($path in @(Get-ChildItem "$repo/scripts","$repo/infrastructure/jenkins","$repo/backend/docker" -Filter *.ps1 -Recurse)) {
  $parseErrors=$null;$tokens=$null
  $null=[Management.Automation.Language.Parser]::ParseFile($path.FullName,[ref]$tokens,[ref]$parseErrors)
  Assert-Test ($parseErrors.Count -eq 0) "PowerShell parse failure: $($path.FullName) $parseErrors"
 }
 Write-Host "$global:cinnaiTest_checks script regression checks passed (all cloud/Docker calls mocked)."
} finally {
 Pop-Location
 foreach ($key in $saved.Keys) {[Environment]::SetEnvironmentVariable($key,$saved[$key])}
 # Only this invocation's UUID temp tree is removed.
 $resolved=[IO.Path]::GetFullPath($testRoot)
 $temp=[IO.Path]::GetFullPath((Join-Path $repo '.test-tmp'))
 if ($resolved.StartsWith($temp) -and (Split-Path $resolved -Leaf) -like 'cinnai-script-tests-*') {Remove-Item -LiteralPath $resolved -Recurse -Force}
}
