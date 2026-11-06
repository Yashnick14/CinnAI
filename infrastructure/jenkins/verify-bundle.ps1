function Assert-ReleaseBundle {
 param([string]$Manifest,[string]$Archive,[string]$Commit,[string]$BuildNumber)
 $m=Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
 if ($m.schema -ne 1 -or $m.tests_passed -ne $true -or $m.commit -cne $Commit -or [string]$m.build_number -cne $BuildNumber) {throw 'Bundle does not match successful requested build/commit'}
 if ($m.image_id -notmatch '^sha256:[a-f0-9]{64}$' -or $m.archive_sha256 -notmatch '^[a-f0-9]{64}$') {throw 'Malformed image/archive digest'}
 if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLower() -cne $m.archive_sha256) {throw 'Image archive checksum mismatch'}
 return $m
}
