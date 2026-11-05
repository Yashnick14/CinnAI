param([switch]$PlanOnly,[switch]$Destroy)
$ErrorActionPreference='Stop'
if ($PlanOnly.IsPresent -eq $Destroy.IsPresent) {throw 'Specify exactly one of -PlanOnly or -Destroy'}
. "$PSScriptRoot/../infrastructure/jenkins/policy.ps1"
$root=(Resolve-Path "$PSScriptRoot/..").Path
if ((az account show --query id -o tsv).Trim() -ne '666a8489-014b-456e-8d3a-3b531503b1b3') {throw 'Wrong subscription'}
if ($Destroy) {
 if ((Read-Host 'Type DELETE CINNAI APPLICATION AND DATABASE after verified offsite backups') -cne 'DELETE CINNAI APPLICATION AND DATABASE') {throw 'Cancelled'}
}
foreach ($stack in @('application','foundation')) {
 $dir=Join-Path $root "infrastructure/terraform/$stack"
 $backend=Join-Path $dir 'local.backend.hcl'
 $vars=Join-Path $dir 'terraform.tfvars'
 if (!(Test-Path $backend) -or !(Test-Path $vars)) {throw "Missing reviewed local backend/vars for $stack"}
 Invoke-Checked terraform @("-chdir=$dir",'init','-reconfigure','-input=false',"-backend-config=$backend")
 $state=(terraform "-chdir=$dir" show -json | ConvertFrom-Json)
 if ($LASTEXITCODE -ne 0) {throw 'Cannot inspect state'}
 if ($state.values.root_module.child_modules) {throw 'Nested modules require explicit destruction scope review'}
 foreach ($r in $state.values.root_module.resources) {
  if ($r.mode -ne 'managed') {continue}
  if ($r.values.id -notlike '/subscriptions/666a8489-014b-456e-8d3a-3b531503b1b3/*') {throw 'Unexpected resource subscription'}
  if ($r.type -eq 'azurerm_resource_group' -and $r.values.name -ne 'cinnai-666a84-rg') {throw 'Unexpected resource group'}
  if ($Destroy -and $r.type -eq 'azurerm_resource_group') {
   $live=az resource list -g $r.values.name --query '[].id' -o json | ConvertFrom-Json
   if ($LASTEXITCODE -ne 0) {throw 'Cannot verify resource group contents'}
   $known=@($state.values.root_module.resources.values.id)
   if (@($live | Where-Object {$_ -notin $known}).Count) {throw 'Resource group includes resources outside this stack; review before deletion'}
  }
 }
 $plan=Join-Path $dir 'destroy-reviewed.tfplan'
 Invoke-Checked terraform @("-chdir=$dir",'plan','-destroy','-input=false',"-var-file=$vars","-out=$plan")
 if ($Destroy) {
  if ((Read-Host "Type DESTROY $stack to approve the displayed saved plan") -cne "DESTROY $stack") {throw 'Cancelled'}
  Invoke-Checked terraform @("-chdir=$dir",'apply','-input=false',$plan)
 }
}
Write-Host 'Bootstrap/state storage intentionally retained. Its prevent_destroy guards remain; final state-storage retirement requires a separately reviewed procedure.'
