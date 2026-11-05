# Explicitly bounded to the private CI Docker daemon. Never prune volumes/images.
$ErrorActionPreference='Stop'
. "$PSScriptRoot/policy.ps1"
if ($env:DOCKER_HOST -cne 'tcp://docker:2376' -or $env:DOCKER_TLS_VERIFY -ne '1') {throw 'Refuse cleanup outside isolated TLS CI daemon'}
Invoke-Checked docker @('builder','prune','--force','--filter','until=168h','--keep-storage','10GB')
