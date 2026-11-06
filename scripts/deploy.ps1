param([ValidateSet('deploy','rollback')][string]$Action='deploy')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
 if ((git branch --show-current).Trim() -cne 'main' -or (git status --porcelain)) {throw 'Run releases from a clean reviewed main checkout'}
 $subscription=az account show --query id -o tsv
 if ($LASTEXITCODE -ne 0 -or "$subscription".Trim() -ne '666a8489-014b-456e-8d3a-3b531503b1b3') {throw 'Use az login on Windows and select the CinnAI subscription first'}
 $liveApp=az containerapp show -g cinnai-666a84-rg -n cinnai -o json
 if ($LASTEXITCODE -ne 0) {throw 'Cannot read the existing app with this Azure login'}
 . "$root/infrastructure/jenkins/baseline.ps1"
 $null=Resolve-RollbackBaseline ($liveApp | ConvertFrom-Json)
 $local=(git rev-parse refs/heads/main).Trim()
 if ($LASTEXITCODE -ne 0) {throw 'Local main is missing'}
 $remote=git ls-remote origin refs/heads/main
 if ($LASTEXITCODE -ne 0 -or ($remote -split '\s+')[0] -cne $local) {throw 'Local main must match pushed GitHub main'}
 $base=$env:CINNAI_JENKINS_URL
 $job=$env:CINNAI_JENKINS_JOB_PATH
 if ($base -notmatch '^https://' -and $base -notmatch '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/?$' -or $job -notmatch '^job/[A-Za-z0-9_/-]+$') {throw 'Set HTTPS (or loopback HTTP) CINNAI_JENKINS_URL and CINNAI_JENKINS_JOB_PATH (e.g. job/cinnai-release)'}
 $credential=Get-Credential -Message 'Jenkins username and API token (password field)'
 $pair=$credential.UserName+':'+$credential.GetNetworkCredential().Password
 $headers=@{Authorization='Basic '+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))}
 $pair=$null
 $base=$base.TrimEnd('/')
 # API tokens are CSRF-exempt on supported Jenkins. Do not disable CSRF globally.
 $response=Invoke-WebRequest "$base/$job/buildWithParameters" -Method Post -Headers $headers -Body @{COMMIT_SHA=$local;ACTION=$Action} -UseBasicParsing
 $queue=[Uri]::new([Uri]($base+'/'),[string]$response.Headers.Location).AbsoluteUri
 if (!($queue.StartsWith($base+'/queue/item/'))) {throw 'Untrusted queue URL'}
 $deadline=(Get-Date).AddHours(4)
 do {
  Start-Sleep 3
  $q=Invoke-RestMethod "$queue/api/json" -Headers $headers
  if ($q.cancelled) {throw 'Jenkins queue cancelled'}
  if ((Get-Date) -gt $deadline) {throw 'Queue wait timed out; inspect Jenkins before retrying'}
 } until ($q.executable)
 $build=[string]$q.executable.url
 if (!$build.StartsWith("$base/$job/")) {throw 'Untrusted build URL'}
 Write-Host "Tracking $build"
 do {
  Start-Sleep 5
  $b=Invoke-RestMethod "$build/api/json" -Headers $headers
  if ((Get-Date) -gt $deadline) {throw 'Build wait timed out; job may still be running'}
 } while ($b.building -or !$b.result)
 if ($b.result -ne 'SUCCESS') {throw "Jenkins result: $($b.result). See $build"}
 & "$root/infrastructure/jenkins/windows-release.ps1" -Action $Action -Commit $local -Build $build -BuildNumber ([string]$b.number) -Headers $headers
} finally { $headers=$null; $credential=$null; Pop-Location }
