param([ValidateSet('foundation','application')][string]$Stack)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/policy.ps1"
if ($env:CHANGE_ID -or $env:TAG_NAME -or $env:BRANCH_NAME -cnotin @('main','development','Development')) { throw 'Live plans require a trusted branch, not PRs or tags' }
$env:ARM_USE_CLI = 'false'
if ($env:ARM_SUBSCRIPTION_ID -ne '666a8489-014b-456e-8d3a-3b531503b1b3') { throw 'Unexpected subscription' }
# Identity MUST be Azure Reader + state Blob Data Reader only. No writes/leases.
# Remote backend must already exist. This script cannot bootstrap infrastructure.
$dir = "infrastructure/terraform/$Stack"
Invoke-Checked terraform @("-chdir=$dir",'init','-reconfigure','-input=false',"-backend-config=$env:TF_BACKEND_FILE",'-no-color')
Invoke-Checked terraform @("-chdir=$dir",'plan','-lock=false','-input=false',"-var-file=$env:TF_VARS_FILE",'-no-color')
