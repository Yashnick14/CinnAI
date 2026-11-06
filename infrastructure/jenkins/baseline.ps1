# Bootstrap evidence: ACR tag created/last updated 2026-10-31T05:08:04.3347135Z;
# revision created 2026-10-31T06:02:03Z. No running replica digest was available.
# Tag, OCI index and both referenced manifests were locked on 2026-11-06.
function Resolve-RollbackBaseline($App) {
 $image=$App.properties.template.containers[0].image
 if ($image -match '^cinnai666a84\.azurecr\.io/backend@sha256:[a-f0-9]{64}$') {return $image}
 $digest='sha256:ea7fa146ffbca5caba637db5aa59100f194537440d056f1c30f1ff4828662533'
 if ($image -cne 'cinnai666a84.azurecr.io/backend:cloud-af7814c' -or $App.properties.latestRevisionName -cne 'cinnai--0000004' -or $App.properties.latestReadyRevisionName -cne 'cinnai--0000004') {throw 'Unrecognized tagged baseline or changed revision; review required'}
 foreach ($reference in @('backend:cloud-af7814c',"backend@$digest",'backend@sha256:8191ea06930663443395e97a7f66cfad79805f7645471af24b4b5348ddb6dbd7','backend@sha256:b7c3c692dfef877dd0d6c4fc2c32c675a6342b7e6afc1a59e6f939631d269a53')) {
  $raw=az acr repository show -n cinnai666a84 --image $reference -o json
  if ($LASTEXITCODE -ne 0) {throw 'Cannot verify retained baseline'}
  $metadata=$raw | ConvertFrom-Json
  $expected=if($reference.Contains('@')) {($reference -split '@')[1]} else {$digest}
  if ($metadata.digest -cne $expected -or $metadata.changeableAttributes.deleteEnabled -ne $false -or $metadata.changeableAttributes.writeEnabled -ne $false -or $metadata.changeableAttributes.readEnabled -ne $true) {throw 'Baseline digest/retention protection changed'}
 }
 return "cinnai666a84.azurecr.io/backend@$digest"
}
