$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'validate.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
$helper = $ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-Docker'}, $true)
Invoke-Expression $helper.Extent.Text
# Substitute only the executable, keeping the exact production wrapper behavior.
function docker { & python @args; $global:LASTEXITCODE = $LASTEXITCODE }
$lines = Invoke-Docker @('-c', 'import sys; print(''normal stdout''); print(''INFO: Started server process [1]'', file=sys.stderr)')
if (-not (($lines -join " ") -match 'INFO: Started')) { throw 'stderr was lost' }
$caught = $false
try { Invoke-Docker @('-c', 'import sys; print(''genuine failure'', file=sys.stderr); sys.exit(7)') | Out-Null }
catch { if ($_ -notmatch 'exit 7') { throw }; $caught = $true }
if (-not $caught) { throw 'Nonzero exit was not preserved' }
Write-Output 'PASS: normal stderr accepted; nonzero exit 7 throws.'
