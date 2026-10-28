function Assert-MainRelease {
    param([string]$Branch, [string]$ChangeId, [string]$Tag, [string]$ValidatedCommit, [string]$Head)
    if ($Branch -cne 'main' -or $ChangeId -or $Tag) { throw 'Release is allowed only from the main branch, never PRs or tags.' }
    if ($Head -notmatch '^[0-9a-f]{40}$' -or $ValidatedCommit -cne $Head) { throw 'Release commit must equal the commit that passed validation.' }
}
function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}
