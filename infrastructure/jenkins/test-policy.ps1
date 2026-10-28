$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/policy.ps1"
$sha = 'a' * 40
$cases = @(
    @{Branch='main'; Change=''; Tag=''; Commit=$sha; Head=$sha; Allowed=$true},
    @{Branch='development'; Change=''; Tag=''; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch='Development'; Change=''; Tag=''; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch='Main'; Change=''; Tag=''; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch='main'; Change='12'; Tag=''; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch='main'; Change=''; Tag='v1'; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch=''; Change=''; Tag=''; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch='feature/ui'; Change=''; Tag=''; Commit=$sha; Head=$sha; Allowed=$false},
    @{Branch='main'; Change=''; Tag=''; Commit=''; Head=$sha; Allowed=$false},
    @{Branch='main'; Change=''; Tag=''; Commit=$sha; Head=('b'*40); Allowed=$false}
)
foreach ($c in $cases) {
    $allowed = $true
    try { Assert-MainRelease $c.Branch $c.Change $c.Tag $c.Commit $c.Head } catch { $allowed = $false }
    if ($allowed -ne $c.Allowed) { throw "Unexpected release permission: $($c.Branch)" }
}
Write-Host "$($cases.Count) branch/commit guard tests passed."
