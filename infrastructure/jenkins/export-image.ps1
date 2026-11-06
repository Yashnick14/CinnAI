$ErrorActionPreference='Stop'
. "$PSScriptRoot/policy.ps1"
Assert-MainRelease $env:BRANCH_NAME $env:CHANGE_ID $env:TAG_NAME $env:VALIDATED_COMMIT ((git rev-parse HEAD).Trim())
$image=(Get-Content .ci-tested-image.txt -Raw).Trim()
if ($image -notmatch '^sha256:[a-f0-9]{64}$') {throw 'Missing tested image ID'}
$null=New-Item -ItemType Directory -Force release-bundle
Invoke-Checked docker @('save','--output','release-bundle/image.tar',$image)
@{schema=1;commit=$env:VALIDATED_COMMIT;image_id=$image;archive_sha256=(Get-FileHash release-bundle/image.tar -Algorithm SHA256).Hash.ToLower();build_number=$env:BUILD_NUMBER;tests_passed=$true} | ConvertTo-Json | Set-Content release-bundle/manifest.json
