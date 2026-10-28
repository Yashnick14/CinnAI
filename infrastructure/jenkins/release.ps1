param([ValidateSet('foundation','application')][string]$Stack, [ValidateSet('Plan','Apply','Publish','Health')][string]$Action)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/policy.ps1"
$env:ARM_USE_CLI = 'false'
if ($env:ARM_SUBSCRIPTION_ID -ne '666a8489-014b-456e-8d3a-3b531503b1b3') { throw 'Release subscription differs from approved CinnAI subscription' }
$head = (git rev-parse HEAD).Trim()
Assert-MainRelease $env:BRANCH_NAME $env:CHANGE_ID $env:TAG_NAME $env:VALIDATED_COMMIT $head
# Refuse delayed builds if main has advanced since tests/approval.
$remote = @(git ls-remote origin refs/heads/main)
if ($LASTEXITCODE -ne 0 -or $remote.Count -ne 1 -or ($remote[0] -split '\s+')[0] -cne $head) { throw 'Checkout is no longer the current remote main commit.' }
$tfdir = "infrastructure/terraform/$Stack"
if ($Action -eq 'Publish') {
    if ($Stack -ne 'application') { throw 'Foundation cannot publish images' }
    if ($env:ACR_NAME -notmatch '^[a-z0-9]{5,50}$') { throw 'Configure ACR_NAME in protected release job settings' }
    # Azure/Docker config paths must be private to the release agent (see README).
    Invoke-Checked az @('login','--service-principal','--username',$env:ARM_CLIENT_ID,'--password',$env:ARM_CLIENT_SECRET,'--tenant',$env:ARM_TENANT_ID,'--output','none')
    Invoke-Checked az @('account','set','--subscription',$env:ARM_SUBSCRIPTION_ID)
    Invoke-Checked az @('acr','login','--name',$env:ACR_NAME)
    $registry = (az acr show --name $env:ACR_NAME --query loginServer -o tsv).Trim()
    if ($LASTEXITCODE -ne 0 -or $registry -notmatch '^[a-z0-9.-]+\.azurecr\.io$') { throw 'Invalid registry' }
    $tag = "$registry/backend:$head"
    $testedImage = (Get-Content .ci-tested-image.txt -Raw).Trim()
    if ($testedImage -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Missing tested image ID' }
    Invoke-Checked docker @('tag',$testedImage,$tag)
    Invoke-Checked docker @('push',$tag)
    $refs = (docker image inspect $tag --format '{{json .RepoDigests}}') | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Digest lookup failed' }
    $digest = @($refs | Where-Object { $_ -match ('^'+[regex]::Escape("$registry/backend@sha256:")+'[a-f0-9]{64}$') })
    if ($digest.Count -ne 1) { throw 'Cannot determine immutable pushed image digest' }
    Set-Content .ci-image.txt $digest[0]
    exit
}
Invoke-Checked terraform @("-chdir=$tfdir",'init','-reconfigure','-input=false',"-backend-config=$env:TF_BACKEND_FILE",'-no-color')
if ($Action -eq 'Plan') {
    $argsList = @("-chdir=$tfdir",'plan','-input=false',"-var-file=$env:TF_VARS_FILE",'-out=release.tfplan','-no-color')
    if ($Stack -eq 'application') {
        $image = (Get-Content .ci-image.txt -Raw).Trim()
        if ($image -notmatch '@sha256:[a-f0-9]{64}$') { throw 'Missing tested digest' }
        $argsList += "-var=image=$image"
    }
    Invoke-Checked terraform $argsList
    (Get-FileHash "$tfdir/release.tfplan" -Algorithm SHA256).Hash | Set-Content "$tfdir/release-plan.sha256"
} elseif ($Action -eq 'Apply') {
    $expected = (Get-Content "$tfdir/release-plan.sha256" -Raw).Trim()
    if ((Get-FileHash "$tfdir/release.tfplan" -Algorithm SHA256).Hash -cne $expected) { throw 'Plan changed after review' }
    Invoke-Checked terraform @("-chdir=$tfdir",'apply','-input=false','-no-color','release.tfplan')
} else {
    $url = (terraform "-chdir=$tfdir" output -raw url).Trim()
    if ($LASTEXITCODE -ne 0 -or $url -notmatch '^https://[a-z0-9.-]+\.azurecontainerapps\.io$') { throw 'Invalid health URL' }
    for ($i=0; $i -lt 12; $i++) {
        try { $r = Invoke-RestMethod "$url/health" -TimeoutSec 20; if ($r.status -eq 'ok') { Write-Host 'Deployment healthy'; exit } } catch { Write-Host 'Waiting for readiness' }
        Start-Sleep -Seconds 10
    }
    throw 'Deployment health check failed'
}


