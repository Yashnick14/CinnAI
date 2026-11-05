$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/policy.ps1"
& "$PSScriptRoot/test-policy.ps1"
& "$PSScriptRoot/test-scripts.ps1"
& "$PSScriptRoot/prepare-inputs.ps1"
$head = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve checkout' }
Push-Location frontend
try {
    Invoke-Checked npm @('ci')
    Invoke-Checked npm @('run', 'lint')
    Invoke-Checked npm @('run', 'test')
    Invoke-Checked npm @('run', 'typecheck')
} finally { Pop-Location }
Invoke-Checked terraform @('fmt','-check','-recursive','infrastructure/terraform')
foreach ($stack in @('bootstrap','foundation','application')) {
    Invoke-Checked terraform @("-chdir=infrastructure/terraform/$stack",'init','-backend=false','-input=false','-no-color')
    Invoke-Checked terraform @("-chdir=infrastructure/terraform/$stack",'validate','-no-color')
    Invoke-Checked terraform @("-chdir=infrastructure/terraform/$stack",'test','-no-color')
}
# Existing Linux suite builds production/test images, runs backend tests and inference.
# Jenkins holds a cross-job lock because this validator uses fixed local image tags.
& ./backend/docker/validate.ps1 -OutputDirectory (Join-Path (Get-Location) ".ci-reports/docker")
if (-not $?) { throw 'Docker validation failed' }
& "$PSScriptRoot/test-postgres.ps1"
Invoke-Checked docker @('tag','cinnai-backend:local',"cinnai-validated:$head")
$imageId = (docker image inspect "cinnai-validated:$head" --format '{{.Id}}').Trim()
if ($LASTEXITCODE -ne 0 -or $imageId -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Missing tested image ID' }
$imageId | Set-Content .ci-tested-image.txt
