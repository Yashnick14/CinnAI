$ErrorActionPreference='Stop'
. "$PSScriptRoot/baseline.ps1"
$script:tamper=$false
function az {
 $global:LASTEXITCODE=0
 $ref=$args[[Array]::IndexOf($args,'--image')+1]
 $digest=if($ref.Contains('@')) {($ref -split '@')[1]} else {'sha256:ea7fa146ffbca5caba637db5aa59100f194537440d056f1c30f1ff4828662533'}
 @{digest=$digest;changeableAttributes=@{deleteEnabled=$script:tamper;writeEnabled=$false;readEnabled=$true}} | ConvertTo-Json
}
$app=@{properties=@{template=@{containers=@(@{image='cinnai666a84.azurecr.io/backend:cloud-af7814c'})};latestRevisionName='cinnai--0000004';latestReadyRevisionName='cinnai--0000004'}}
$target=Resolve-RollbackBaseline $app
if ($target -cne 'cinnai666a84.azurecr.io/backend@sha256:ea7fa146ffbca5caba637db5aa59100f194537440d056f1c30f1ff4828662533') {throw 'Wrong baseline'}
$script:tamper=$true
$caught=$false;try {Resolve-RollbackBaseline $app} catch {$caught=$true}
if (!$caught) {throw 'Unlocked baseline accepted'}
$script:tamper=$false;$app.properties.latestRevisionName='other'
$caught=$false;try {Resolve-RollbackBaseline $app} catch {$caught=$true}
if (!$caught) {throw 'Changed revision accepted'}
$app.properties.template.containers[0].image=$target
if ((Resolve-RollbackBaseline $app) -cne $target) {throw 'Immutable baseline regression'}
Write-Host '4 baseline tests passed (Azure mocked).'
