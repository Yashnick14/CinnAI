$ErrorActionPreference='Stop'
$source='/opt/cinnai-inputs'
$models=@('quill_detector_v5.pt','coin_quill_segmentation.pt','rf_vision_8_class.pkl')
foreach ($name in $models) {
 $target="backend/models/$name"
 if (!(Test-Path $target)) {
  New-Item -ItemType Directory -Force backend/models | Out-Null
  Copy-Item -LiteralPath "$source/models/$name" -Destination $target
 }
}
foreach ($name in @('FYP.ipynb','test_images')) {
 $target="backend/backend_handoff/$name"
 if (!(Test-Path $target)) {
  New-Item -ItemType Directory -Force backend/backend_handoff | Out-Null
  Copy-Item -LiteralPath "$source/fixtures/$name" -Destination $target -Recurse
 }
}
if (@(Get-ChildItem backend/backend_handoff/test_images -Filter *.jpg).Count -lt 3) {throw 'Three real inference fixtures are required'}
