param([ValidateSet('deploy','rollback')][string]$Action)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/policy.ps1"
Assert-MainRelease $env:BRANCH_NAME $env:CHANGE_ID $env:TAG_NAME $env:VALIDATED_COMMIT ((git rev-parse HEAD).Trim())
function Read-App {
 $raw=az containerapp show -g cinnai-666a84-rg -n cinnai -o json
 if ($LASTEXITCODE -ne 0) {throw 'Cannot read application'}
 $raw | ConvertFrom-Json
}
function Wait-Healthy([string]$Image) {
 for ($i=0;$i -lt 36;$i++) {
  $a=Read-App
  if ($a.properties.latestRevisionName -eq $a.properties.latestReadyRevisionName -and $a.properties.template.containers[0].image -eq $Image) {
   try {
    $url="https://$($a.properties.configuration.ingress.fqdn)"
    if ((Invoke-RestMethod "$url/health" -TimeoutSec 20).status -eq 'ok') {return @{url=$url;revision=$a.properties.latestReadyRevisionName}}
   } catch {}
  }
  Start-Sleep 10
 }
 throw 'Revision health check failed'
}
if ((az account show --query id -o tsv).Trim() -ne '666a8489-014b-456e-8d3a-3b531503b1b3') {throw 'Wrong subscription'}
if (!$env:CINNAI_RELEASE_LEDGER -or ![IO.Path]::IsPathRooted($env:CINNAI_RELEASE_LEDGER)) {throw 'Configure a private durable release ledger path outside workspace'}
New-Item -ItemType Directory -Force (Split-Path $env:CINNAI_RELEASE_LEDGER -Parent) | Out-Null
$ledgerFull=[IO.Path]::GetFullPath($env:CINNAI_RELEASE_LEDGER)
$workspaceFull=[IO.Path]::GetFullPath((Get-Location).Path).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
if ($ledgerFull.StartsWith($workspaceFull,[StringComparison]::OrdinalIgnoreCase)) {throw 'Release ledger must be outside the checkout'}
$before=Read-App
if ($before.properties.configuration.activeRevisionsMode -ne 'Single') {throw 'Release requires the reviewed Single revision configuration'}
$oldImage=$before.properties.template.containers[0].image
if ($oldImage -notmatch '@sha256:[a-f0-9]{64}$') {throw 'Immutable rollback baseline required'}
$baseline=Wait-Healthy $oldImage
if ($Action -eq 'rollback') {
 $record=Get-Content $env:CINNAI_RELEASE_LEDGER -Raw | ConvertFrom-Json
 if ($oldImage -ne $record.deployed_image) {throw 'Deployment changed since ledger; refuse rollback'}
 $target=$record.previous_image
} else {
 $remote=git ls-remote origin refs/heads/main
 if ($LASTEXITCODE -ne 0 -or ($remote -split '\s+')[0] -ne $env:VALIDATED_COMMIT) {throw 'Remote main advanced'}
 Invoke-Checked az @('acr','login','--name','cinnai666a84')
 $tag="cinnai666a84.azurecr.io/backend:$env:VALIDATED_COMMIT"
 $tested=(Get-Content .ci-tested-image.txt -Raw).Trim()
 if ($tested -notmatch '^sha256:[a-f0-9]{64}$') {throw 'Missing tested image'}
 Invoke-Checked docker @('tag',$tested,$tag)
 Invoke-Checked docker @('push',$tag)
 $digest=(az acr repository show --name cinnai666a84 --image "backend:$env:VALIDATED_COMMIT" --query digest -o tsv).Trim()
 if ($LASTEXITCODE -ne 0 -or $digest -notmatch '^sha256:[a-f0-9]{64}$') {throw 'Invalid digest'}
 $target="cinnai666a84.azurecr.io/backend@$digest"
 if ($target -eq $oldImage) {throw 'Image is already deployed; preserve previous rollback ledger'}
 @{previous_image=$oldImage;previous_revision=$baseline.revision;deployed_image=$target;commit=$env:VALIDATED_COMMIT} | ConvertTo-Json | Set-Content "$env:CINNAI_RELEASE_LEDGER.tmp"
 Move-Item -LiteralPath "$env:CINNAI_RELEASE_LEDGER.tmp" -Destination $env:CINNAI_RELEASE_LEDGER -Force
}
if ($target -notmatch '^cinnai666a84\.azurecr\.io/backend@sha256:[a-f0-9]{64}$') {throw 'Invalid rollback/deploy target'}
try {
 Invoke-Checked az @('containerapp','update','-g','cinnai-666a84-rg','-n','cinnai','--image',$target,'-o','none')
 $result=Wait-Healthy $target
} catch {
 if ($Action -eq 'deploy' -and (Read-App).properties.template.containers[0].image -eq $target) {
  Invoke-Checked az @('containerapp','update','-g','cinnai-666a84-rg','-n','cinnai','--image',$oldImage,'-o','none')
  $null=Wait-Healthy $oldImage
 }
 throw
}
@{action=$Action;commit=$env:VALIDATED_COMMIT;image=$target;url=$result.url;revision=$result.revision} | ConvertTo-Json | Set-Content release-result.json
