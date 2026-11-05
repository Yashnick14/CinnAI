# Isolated disposable PostgreSQL. Never connects to cloud or the user's database.
$ErrorActionPreference='Stop'
. "$PSScriptRoot/policy.ps1"
$id=[guid]::NewGuid().ToString('N').Substring(0,12)
$network="cinnai-ci-pg-$id"
$server="cinnai-ci-pg-$id"
$backend=(Resolve-Path "$PSScriptRoot/../../backend").Path
$networkCreated=$false
try {
 Invoke-Checked docker @('network','create','--internal',$network)
 $networkCreated=$true
 # Disposable test-only password, internal network, no published port or persistent volume.
 Invoke-Checked docker @('run','-d','--name',$server,'--network',$network,'--network-alias','postgres',
  '--memory','512m','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=512m',
  '-e','POSTGRES_USER=cinnai_test','-e','POSTGRES_PASSWORD=ephemeral-ci-only','-e','POSTGRES_DB=cinnai_test','postgres:16-bookworm')
 $ready=$false
 for ($i=0;$i -lt 45;$i++) {
  docker exec $server pg_isready -U cinnai_test -d cinnai_test *> $null
  if ($LASTEXITCODE -eq 0) {$ready=$true;break}
  Start-Sleep 2
 }
 if (!$ready) {throw 'Disposable PostgreSQL did not become ready'}
 Invoke-Checked docker @('run','--rm','--network',$network,'--memory','2g','--read-only',
  '--tmpfs','/tmp:rw,nosuid,size=512m,mode=1777','--tmpfs','/var/lib/cinnai:rw,nosuid,size=256m,mode=1777',
  '--mount',"type=bind,source=$backend/tests,target=/app/tests,readonly",
  '-e','TEST_CLOUD_DATABASE_URL=postgresql+psycopg://cinnai_test:ephemeral-ci-only@postgres/cinnai_test',
  'cinnai-backend:test','python','-B','-m','pytest','tests/test_cloud.py::test_real_postgresql_migration_crud_if_configured','-v','-p','no:cacheprovider')
} finally {
 if ($networkCreated) {
  docker rm -f $server *> $null
  docker network rm $network *> $null
 }
}
