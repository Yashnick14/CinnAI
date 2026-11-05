param([Parameter(Mandatory)][ValidateSet('admin-password','agent-secret')][string]$Name)
$ErrorActionPreference='Stop'
$dir=Join-Path $PSScriptRoot 'secrets'
New-Item -ItemType Directory -Force $dir | Out-Null
if ($IsWindows -or $env:OS -eq 'Windows_NT') {
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 & icacls $dir /inheritance:r /grant:r "${owner}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
 if ($LASTEXITCODE -ne 0) {throw 'Cannot restrict secret directory permissions'}
} else { & chmod 700 $dir; if ($LASTEXITCODE -ne 0) {throw 'Cannot secure secret directory'} }
$value=Read-Host "Enter $Name (hidden; do not commit this file)" -AsSecureString
$plain=[Net.NetworkCredential]::new('', $value).Password
if ([string]::IsNullOrWhiteSpace($plain)) {throw 'Secret cannot be empty'}
if ($Name -eq 'admin-password' -and $plain.Length -lt 16) {throw 'Use at least 16 characters for the administrator password'}
[IO.File]::WriteAllText((Join-Path $dir $Name),$plain,[Text.UTF8Encoding]::new($false))
$plain=$null;$value=$null
if ($Name -eq 'admin-password' -and !(Test-Path (Join-Path $dir 'agent-secret'))) {
 [IO.File]::WriteAllText((Join-Path $dir 'agent-secret'),'NOT-CONFIGURED')
}
Write-Host "Saved $Name in the restricted, Git-ignored secrets directory."
