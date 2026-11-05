## Update: successful user-executed Linux validation

The supplied log confirms 197 backend tests passed, then the real PostgreSQL migration/CRUD test passed separately. Linux model smoke tests returned PASS. The local report status.txt is PASS and Docker reports were copied successfully into `.test-tmp/local-ci-1da55ddf4a824678ae9cd5b4c041f266/.ci-reports/docker`.

The wrapper then failed because Windows PowerShell treated Docker's successful-copy stderr message as an error. validate-local.ps1 now uses exit-code-aware Invoke-Checked for copying and helper cleanup, with nested finally blocks. A real Windows PowerShell check confirmed stderr with exit 0 succeeds and exit 7 still fails; all 30 existing script checks pass. No full rebuild is needed for this wrapper fix. Earlier access limitations below describe the assistant session, not the user's run. Jenkins job execution and Azure deployment remain unverified and were not performed.

# Local Jenkins change validation — 2026-11-04

Repository branch: Development. No merge, push, Azure resource mutation, application deployment, host Docker cleanup or PostgreSQL data modification was performed.

## Results actually executed

- Frontend lint (ESLint 10 safety rules): PASS.
- TypeScript: PASS.
- Frontend Vitest: 251 passed across 24 files.
- Backend: 197 passed, 1 skipped. The skipped test requires real PostgreSQL; no database connection was supplied to this local run. The new disposable PostgreSQL stage must execute this test in Linux CI.
- Branch/commit guard tests: 10 passed.
- Script regression checks: 30 passed, including deployment, rollback, automatic recovery after failed health, Development rejection, mismatched commit rejection, missing/nonzero native-command handling, cleanup isolation and PowerShell syntax. All cloud/Docker calls in these tests are mocked.
- Docker Compose configuration including agent profile: PASS.
- git diff whitespace check: PASS.

An initial backend run failed because the sandbox could not create the default system temporary test directory. Re-running with a unique workspace-local basetemp produced the passing backend result above.

## Runtime checks still pending

This process receives Access is denied opening Docker Desktop's Linux-engine named pipe. This is a session access limitation, not evidence that Docker Desktop is stopped. No controller or agent build/start was claimed. Jenkins Pipeline runtime compilation, container image build, disposable PostgreSQL integration, Linux model inference and real deployment/rollback remain unexecuted in this session.

Run `validate-local.ps1` from your own PowerShell as described in README.md. It requires no Azure credentials and does not deploy. After that passes, configure Jenkins and run the protected pipeline only following your manual review/merge/push to main. Azure service-principal setup is also pending; no identity or RBAC resources were created.

Dependency installation reported 33 npm audit findings across the dependency tree (2 low, 21 moderate, 8 high, 2 critical). No broad automatic dependency upgrades were attempted; this is not a dependency-security certification.

## Files changed/added for this implementation

- `.gitignore`: local secrets, CI reports and release artifacts excluded.
- `Jenkinsfile`: Linux validation agent, trusted branches only.
- `Jenkinsfile.release`: exact-main release/rollback, required tests, certificate-based login, immutable image release and bounded cache cleanup.
- `Jenkinsfile.infrastructure`: separate foundation-only approval-gated infrastructure workflow.
- `backend/docker/validate.ps1`: cross-platform temporary report directory.
- `backend/tests/test_cloud.py`: extended real PostgreSQL history JSON/owner/update/delete coverage.
- `frontend/package.json`, `frontend/package-lock.json`, `frontend/eslint.config.mjs`: lint command and dependencies; no frontend UI/behavior changes.
- `infrastructure/jenkins/policy.ps1`: fail closed when a required command is missing.
- `infrastructure/jenkins/validate.ps1`: lint, script checks, input preparation, real PostgreSQL stage and reports.
- `infrastructure/jenkins/image-release.ps1`: immutable image release and persistent rollback ledger, health recovery.
- `infrastructure/jenkins/prepare-inputs.ps1`: explicit model/fixture hydration.
- `infrastructure/jenkins/test-postgres.ps1`: isolated temporary PostgreSQL network/container and migration/CRUD gate.
- `infrastructure/jenkins/test-scripts.ps1`: mocked script regression checks and syntax checks.
- `infrastructure/jenkins/cleanup-cache.ps1`: private-daemon-only bounded builder-cache cleanup.
- `scripts/deploy.ps1`, `scripts/rollback.ps1`, `scripts/destroy-infrastructure.ps1`: manual trigger, protected rollback and separately confirmed destruction.
- `infrastructure/jenkins/local/compose.yaml`, `Controller.Dockerfile`, `Agent.Dockerfile`, `plugins.txt`, `jenkins.yaml`, `.dockerignore`: isolated persistent local Jenkins stack.
- `infrastructure/jenkins/local/set-secret.ps1`, `validate-local.ps1`: ACL-protected local secret setup and no-deployment Linux validation runner.
- `infrastructure/jenkins/local/README.md`, `VALIDATION.md`: setup, credentials, verification and actual validation status.
- `infrastructure/jenkins/README.md`, `REMOTE_SETUP.md`: point to the current local setup. The remote scaffold from the preceding unfinished work remains unused.

Application models, inference, calibration, grading rules, firmware, live infrastructure and Terraform state remain unchanged.
