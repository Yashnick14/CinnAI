# CinnAI — Cinnamon Hybrid Grading

CinnAI combines a FastAPI backend, an Expo/React Native app, Firebase Authentication,
PostgreSQL history and ESP32 moisture telemetry. This README is the main setup and
operations guide. Calibration and validation reports remain beside their evidence.

## Contents

- [Project structure](#project-structure)
- [Local setup and environment](#local-setup-and-environment)
- [Authentication and reports](#authentication-and-reports)
- [Models and measurement](#models-and-measurement)
- [Database and sensor services](#database-and-sensor-services)
- [ESP32 setup](#esp32-setup)
- [Tests and Docker](#tests-and-docker)
- [Azure and Terraform](#azure-and-terraform)
- [Jenkins and releases](#jenkins-and-releases)
- [Evidence](#evidence)

## Project structure

| Location | Purpose |
| --- | --- |
| `backend/app/api/routes/` | Inference and assistant HTTP endpoints |
| `backend/app/services/` | Validation, measurement orchestration and diagnostics |
| `backend/app/ml/` | Detector, segmentation, visual features and diameter measurement |
| `backend/app/cloud/` | Firebase authorization, PostgreSQL records, reports and sensor telemetry |
| `backend/app/core/config.py` | Backend environment configuration |
| `backend/app/ai_assistant/` | Assistant retrieval, knowledge and saved embeddings |
| `backend/models/` | Active model binaries, provisioned separately from Git |
| `backend/migrations/` | Reviewed Alembic database migrations |
| `backend/tests/`, `frontend/tests/` | Essential regression tests |
| `frontend/src/` | Screens, components, services, authentication and app configuration |
| `firmware/CinnamonGradingWifi/` | ESP32 sketch and private configuration templates |
| `infrastructure/jenkins/` | Local CI, image validation, deployment and rollback |
| `infrastructure/terraform/` | Bootstrap, foundation and application infrastructure |
| `scripts/` | Local startup and protected deployment commands |
| `delete/` | Git-ignored review folder; not application input |

## Local setup and environment

Use Python and Node versions compatible with `backend/Dockerfile` and the Jenkins
agent Dockerfile. Docker Desktop must use Linux containers for the existing CI setup.
Install backend dependencies in a virtual environment and frontend dependencies with
`npm ci`. Do not overwrite an existing `.env` file with its example.

```powershell
# From the project root, first-time setup only:
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm --prefix frontend ci
```

Start the local backend from `backend`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Start Expo from `frontend` with `npm run go`, or use `npm run web` for the browser.
Scan the Expo QR code with the iPhone. For a LAN development server, the phone and
laptop must be reachable on the same network; a deployed HTTPS backend does not
have that restriction. Restart Expo after environment changes; use
`npx expo start --go --clear` when clearing Metro configuration caches is necessary.

Backend `.env.example` documents the supported keys:

- `MODEL_DIRECTORY`: active model location.
- `MAX_IMAGE_BYTES`, `UPLOAD_DIRECTORY`, `TEMP_VISUAL_UPLOAD_DIRECTORY`,
  `V5_COLLECTION_DIRECTORY`: upload limits and writable diagnostic locations.
- `ALLOWED_ORIGINS`: comma-separated permitted browser origins; configure actual
  frontend origins at deployment. Native apps do not use browser CORS.
- `GEMINI_API_KEY`: private assistant credential.
- `ASSISTANT_ENCODER_PATH`, `ASSISTANT_ENCODER_CACHE`: MiniLM and cache configuration.
- `CLOUD_STORAGE_ENABLED`, `FIREBASE_PROJECT_ID`, `CLOUD_DATABASE_URL`: authenticated
  PostgreSQL services. `DATABASE_URL` is the legacy/local setting, not the cloud DSN.

Frontend configuration uses `EXPO_PUBLIC_API_URL`, grading and sensor modes,
`EXPO_PUBLIC_SENSOR_WIFI_URL`, `EXPO_PUBLIC_CLOUD_STORAGE_ENABLED`, Firebase client
configuration and optional Google OAuth client IDs/scheme. All `EXPO_PUBLIC_*`
values are bundled into the app: never put passwords, service-account keys,
Gemini credentials or database URLs there. Real `.env` and credential headers are
ignored by Git. Azure runtime secrets are supplied through Key Vault, not baked
into Docker images. Optional blank credentials must be configured before enabling
the corresponding feature.

## Authentication and reports

Enable Email/Password and Google providers in Firebase Console. Copy Web app client
configuration to the frontend environment and set the same Firebase project ID for
backend verification. Add the web frontend hostname to authorized domains.
Email/password works in Expo Go. Native Google sign-in and BLE require a compatible
development build; a JavaScript reload cannot install native modules. For native
Google sign-in configure OAuth clients, signing fingerprints and the iOS URL scheme
from the environment before rebuilding with the existing EAS profiles.

Password reset uses Firebase email delivery. Check Authentication → Users, spam and
email templates if delivery fails. Do not disable account-enumeration protection.
Account display names are profile names, not unique login IDs.

Normal history is scoped to the authenticated Firebase UID and stored in PostgreSQL.
Admin membership is explicitly provisioned in `cloud_admins`; clients cannot grant
roles. Admins can inspect grader records and generate quality PDFs. Report Settings
is under Settings & About, with company/logo visibility controls and a record
inclusion preference. Settings are stored per administrator. Uploaded PNG/JPEG
logos are validated and resized; consult the active settings schema for limits.
App/backend versions must agree on settings fields before saving new preferences.

## Models and measurement

The active model artifacts are checked against `backend/docker/model-sha256.json`:

| Model | SHA256 |
| --- | --- |
| `quill_detector_v5.pt` | `78a09c742380691bbc53a60e866656aa3b529a171f5aad459125d7adf4c80f1f` |
| `coin_quill_segmentation.pt` | `4ce2b6106517a7b8168a507fe50aad3c74a576e1546f534eb18544cae06ad9f9` |
| `rf_vision_8_class.pkl` | `7f87c62c025d332965c20d2f0075673471810dd5fef9a4c37efd7c2558d9f245` |

Detector class 0 is Quill. Segmentation classes are Coin 0 and Quill 1. The RF uses
21 visual features and eight grades. Provision trusted binaries before testing or
building; do not replace weights to resolve deployment failures.

The Rs.10 coin reference is 26.4 mm. Application grading uses the calibrated diameter
`max(raw_diameter_mm - 1.5, 0)` and retains the raw measurement. The offset is based
on six preliminary validation samples, not universal validation. Existing grade and
manual-review boundaries remain authoritative in backend code. RF visual evidence
and moisture assessment do not silently replace the diameter classification.

The assistant uses the existing knowledge JSON, saved embeddings and MiniLM query
encoder; it does not regenerate document embeddings at runtime. Local first use may
download the encoder; the Linux image bundles it. `GEMINI_API_KEY` is required for
answer generation. Assistant grade extraction uses deterministic application logic,
not an LLM-generated grade. Inference routes include `/health`, `/predict-visual`,
`/measure-diameter`, `/validate-sample` and `/assistant/ask`.

## Database and sensor services

Cloud routes require `CLOUD_STORAGE_ENABLED=true` and a `postgresql+psycopg` DSN with
`sslmode=verify-full`. Configure `sslrootcert` for the operating system; the Linux
container uses `/etc/ssl/certs/ca-certificates.crt`. No schema is created at startup.
Apply only reviewed Alembic migrations with a migration identity, separately from
the least-privilege runtime login. From `backend`, the migration command is
`python -m alembic upgrade <reviewed-revision>`; do not run against an unidentified DSN.
The release script does not automatically apply database migrations.

Firebase ID tokens protect profiles, history, admin reports and device ownership.
Device bearer credentials protect telemetry and pairing-code requests. Pairing codes
are single-use, expire after ten minutes and appear through USB Serial. Latest
readings use server timestamps and become stale after 30 seconds; polling does not
refresh an old reading. Device credentials are random and stored hashed on the server.

Operator commands run from `backend` with an authorized database connection:

```text
python -m app.cloud.manage provision --device <device-id> --output <private-new-file>
python -m app.cloud.manage rotate --device <device-id> --output <private-new-file>
python -m app.cloud.manage prune
```

Check `python -m app.cloud.manage --help` before use. Keep credential output private;
rotation invalidates the old token. Pruning is deliberate telemetry maintenance,
not grading-history deletion. Do not publish credentials, Terraform state or plans.

## ESP32 setup

1. Open `firmware/CinnamonGradingWifi/CinnamonGradingWifi.ino` in Arduino IDE.
2. Install the ESP32 board support and ArduinoJson version 7.
3. Copy `wifi_credentials.example.h` to private `wifi_credentials.h` if absent.
   Configure up to three shared-password networks; do not declare slot 3 twice.
   Enterprise username/password Wi-Fi and captive portals need separate support.
4. For internet telemetry, configure private `cloud_credentials.h` from its example:
   backend HTTPS base URL, issued device ID/token, trusted root CA and cloud enablement.
   Never disable certificate verification. `.env` files are not read by Arduino;
   configuration changes require uploading the sketch again.
5. Verify and upload to the ESP32. Open Serial Monitor at 115200 baud and wait for
   Wi-Fi and successful telemetry. Send `PAIR` with a newline when pairing to an account.
6. Set frontend sensor mode to `cloud` for different-network access. Both sensor and
   phone need internet; they do not need the same Wi-Fi. Existing account pairing
   survives normal disconnect/reconnect. Local `wifi` mode requires LAN reachability.

The current ADC screening thresholds are below 1711 = FAIL, 1711–2849 = PASS,
2850 or greater = UNTOUCHED. ADC is not a calibrated moisture-percentage measurement.
The sampling loop and HTTP latency affect updates; retries back off after failures.
Brownout resets indicate a power problem; verify cable, supply and wiring before
changing software. A stale reading requires checking telemetry, not repeatedly pairing.

## Tests and Docker

From `backend`, run `.venv/Scripts/python.exe -m pytest`. From `frontend`, run:

```powershell
npm run typecheck
npm run lint
npm test
```

Keep tests, fixtures, CI configuration and model checksum files in Git where appropriate.
The regression image directory is `backend/backend_handoff/test_images/`; it needs
`diameter_test_01.jpg`, `diameter_test_02.jpg`, `diameter_test_03.jpg` from the original
Colab calibration/test_images inputs. These are test fixtures, not runtime assets.
Original notebooks may contain private outputs; use the established trusted fixture
provisioning process instead of committing them.

From the project root:

```powershell
docker build --platform linux/amd64 --target production -t cinnai-backend:local backend
powershell.exe -ExecutionPolicy Bypass -File .\backend\docker\validate.ps1
```

The validation script checks Linux model loading/inference and tests. PostgreSQL
integration tests require a disposable test database, never the production DSN.
The container is CPU-only and runs non-root with configured writable paths. Uploads
and diagnostics on ephemeral storage can disappear on restart or scale-to-zero;
PostgreSQL provides persistent grading history. `/health` is the container health endpoint.

## Azure and Terraform

The existing deployment uses one Central India Container App, Consumption, 1 vCPU /
2 GiB and 0–1 replicas; Standard ACR, Key Vault and Blob remote Terraform state.
The PostgreSQL Flexible Server is B1ms, 32 GB, seven-day backup retention in Malaysia
West. Public database networking uses a restricted outbound-IP allowlist; Container
Apps outbound addresses can change. Do not enable the broad Azure-services firewall
exception or create networking resources without approval.

Terraform stacks are `infrastructure/terraform/bootstrap`, `foundation` and
`application`, each with its own state. Keep provider lock files. Copy only examples
to private vars/backend files, confirm subscription and state before planning, and
review every replacement/deletion. Never apply obsolete variables that disable the
existing database. Use `terraform fmt -check -recursive`, `terraform validate` and
mock plan tests for local validation; they do not confirm Azure capacity or permissions.
Remote state initialization uses the stack's reviewed `local.backend.hcl`, for example
`terraform init -reconfigure -backend-config=local.backend.hcl` from that stack.

Infrastructure changes require an explicitly approved saved plan. Ordinary image
releases use the existing deployment scripts; they do not run Terraform apply.
Before an application Terraform plan, align its image variable with the actual live
digest so the plan does not revert the deployed image. Keep state and plans private.
Use Key Vault references for runtime secrets, never plaintext values in Git.

Student benefits expire and are shared across subscription usage. Verify current
eligibility, pricing and remaining credit before new provisioning. Registry, database,
backup/storage operations and traffic can incur charges even when app replicas are
zero. Budget alerts are notifications, not hard spending caps. No paid Jenkins VM,
GPU, dedicated compute or second environment is required by the current workflow.

## Jenkins and releases

### Start the controller

Run these commands from the project root in PowerShell with Docker Desktop in Linux mode:

```powershell
$compose = '.\infrastructure\jenkins\local\compose.yaml'
powershell.exe -ExecutionPolicy Bypass -File .\infrastructure\jenkins\local\set-secret.ps1 -Name admin-password
docker compose -f $compose config --quiet
docker compose -f $compose up -d --build controller
```

Open http://localhost:8080 and sign in as `cinnai-admin` with the password you entered. No setup-wizard password is needed. This password is managed by the secret file; update the file and recreate the controller when rotating it. Keep HTTP loopback-only; CSRF remains enabled.

### Register the Linux agent

Manage Jenkins → Nodes → New Node → `cinnai-local`, Permanent Agent:

- Remote root: `/home/jenkins/agent`
- Executors: **1**
- Labels: `cinnai-release-linux cinnai-validation-linux`
- Usage: only jobs matching label expressions
- Launch: inbound connection; availability: keep online

Save and copy the node's agent secret privately from its launch instructions. Then:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\infrastructure\jenkins\local\set-secret.ps1 -Name agent-secret
docker compose -f $compose --profile agent up -d --build
docker compose -f $compose --profile agent exec agent sh -lc 'java -version; node --version; npm --version; pwsh --version; terraform version; az version; docker version'
```

Verify the node is online. The connection uses WebSocket, not port 50000. Plan for 8–12 GiB available to Docker during ML builds and enough disk for separate CI images/cache. Runtime API memory usage is not the build memory requirement.

### Isolation and credentials

- Controller: zero executors; no Docker socket/client certificate/daemon network; only loopback 8080 is published.
- Agent: separate Linux container; TLS client certificate for the private Docker daemon.
- Docker daemon: private `cinnai-ci_docker_data` volume. Existing host images, PostgreSQL containers and volumes are not mounted.
- Docker-in-Docker is privileged. This separates build storage; it is **not a security sandbox for hostile jobs**. Only the administrator may configure/build/replay jobs. Do not discover forks or PRs. Only your reviewed main/Development code may use this agent. Untrusted CI needs a separate disposable machine.
- Local Compose secrets are ACL-protected host files mounted read-only, not an encrypted vault. Never commit the secrets directory. Protect the Windows account/disk and encrypted backups.
- Named volumes persist Jenkins configuration, credentials, workspace and rollback ledger. Stop/up retains them; do not use `down -v`.
- Build retention: ten builds, five artifact sets. Cache cleanup only targets the private TLS CI daemon, unused builder cache older than seven days, retaining 10 GB. No host/global/volume pruning.

### Validate without Azure deployment

Before activating a release, run the local Linux validation command:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\infrastructure\jenkins\local\validate-local.ps1
```

This copies the working source into an isolated CI workspace, builds the agent and backend images, runs lint/types/frontend tests, script checks, Terraform mock tests, backend/model tests and disposable PostgreSQL migration/CRUD checks. It does not authenticate to Azure or use the user's database. Keep its final output. Compose config validation alone is not an end-to-end pass.

For ongoing development, create a trusted Multibranch Pipeline with script path `Jenkinsfile`. Discover only main and Development; disable fork/PR discovery. Leave LIVE_PLAN=false unless separately configured with read-only credentials. Do not give this job release credentials.

Models and fixtures are mounted read-only under `/opt/cinnai-inputs`; the pipeline copies only the three models, original FYP notebook and test images into a fresh checkout if missing. Docker verifies the existing model SHA256 manifest. AI assistant knowledge/embeddings come from Git. Missing required fixtures must fail validation.

### Configure the protected release job

Create folder `cinnai-production` with admin-only permissions. Store these credentials in that folder, not globally:

| ID | Jenkins kind | Value |
|---|---|---|
| cinnai-github-read | Username/password | GitHub username and repository-scoped read-only token; also used for remote-main checks |

No Azure credentials are stored in Jenkins. Windows uses the existing interactive Azure CLI login; no personal Azure cache is mounted or copied into containers.

Create Pipeline `cinnai-production/cinnai-release`:

In Manage Jenkins → Tools, configure a Git installation named `Default` with executable `git`. The Git credential binding uses that name.

1. Pipeline script from SCM → Git → CinnAI repository with read-only Git credential.
2. Branch specifier `*/main`; script path `Jenkinsfile.release`.
3. No webhook, polling, timer, or PR triggers. Only admin can Build/Configure/Replay.
4. Jenkins must load the parameter definitions before using the trigger script. A first parameterless setup build deliberately fails before release if parameters were not loaded yet.

Enable the release job only after the reviewed pipeline exists on main. Run the parameterless setup build only when needed to load job parameters.

Folder setup: Dashboard → New Item → `cinnai-production` → Folder → Save. Inside it choose Credentials → folder domain → Add Credentials → Username with password, ID `cinnai-github-read`, GitHub username and a repository-scoped read-only token. Then New Item → `cinnai-release` → Pipeline. The repository URL is `https://github.com/Yashnick14/CinnAI.git`. Select that credential in Pipeline SCM configuration. Leave build triggers unchecked.

Current checked-in security configuration grants only `cinnai-admin` Overall/Administer, disables signup and grants no anonymous permissions. Preserve this under Manage Jenkins → Security. Folder inheritance is protected by that admin-only global matrix; do not grant other authenticated users Build, Configure or Replay. Verify these settings in the running dashboard before enabling the job. No Azure credentials are required in either job or folder.

The main-only release job validates and exports the tested image. It never publishes to Azure or updates the app. The Windows client downloads the archive from the exact successful build and checks commit, build number, SHA256 and loaded Docker image ID. Checksums detect corruption; trust still depends on the protected Jenkins controller, job and reviewed main code.

### Normal deployment

After you review, merge Development into main and push main, create a Jenkins API token under your user's Security page, then:

```powershell
$env:CINNAI_JENKINS_URL = 'http://localhost:8080'
$env:CINNAI_JENKINS_JOB_PATH = 'job/cinnai-production/job/cinnai-release'
.\scripts\deploy.ps1
```

Enter Jenkins username/API token in the credential prompt. Keep Docker and the laptop awake. Local main must match pushed main. Jenkins checks the requested SHA against checkout and remote main, runs all validation and exports the tested image without rebuilding it. Windows checks the downloaded manifest/archive and loaded image, then prompts for RELEASE followed by the commit SHA. Only after approval does Windows publish the tested image under the commit tag, resolve its immutable digest, update the existing app and verify revision readiness and HTTPS health. Run az login and select the correct subscription on Windows first. The checkout must be clean main. It refuses an already deployed digest to preserve rollback history. The script waits and prints the verified image, revision and URL. No automatic merge or Git push occurs.

### Rollback and infrastructure

```powershell
.\scripts\rollback.ps1
```

Rollback is a separate command using the same main guard and explicit Windows release confirmation. Jenkins checks main but does not rebuild for rollback. It deploys the previous digest as a new revision, verifies health, and refuses if the live image no longer matches the persistent ledger. It does not undo database migrations. Ledger: `%LOCALAPPDATA%\CinnAI\releases\ledger.json`, protected by a local exclusive deployment lock. Keep a backup. A failed new deployment attempts restoration of the old image and still reports failure.

`Jenkinsfile.infrastructure` is a separate foundation-only main job with hashed plans and explicit human approval before apply. Leave it disabled unless needed. It needs separately scoped infrastructure credentials, current reviewed vars/backend files, and the `cinnai-infrastructure-linux` label. Do not reuse obsolete vars that disable the database. Ordinary deployment never invokes Terraform apply. Before a future application Terraform plan, set its reviewed image variable to the actual live digest to avoid reverting an image release.

```powershell
.\scripts\destroy-infrastructure.ps1 -PlanOnly
# Only after separate approval, backups and review:
# .\scripts\destroy-infrastructure.ps1 -Destroy
```

Destruction uses your interactive Azure CLI identity, scope checks and typed confirmations for application then foundation. Unmanaged resource-group contents stop deletion. Bootstrap/state storage remains protected and needs a separately reviewed retirement procedure. Never schedule destruction or give release credentials destruction permission.

### Verify and stop safely

After an authorized successful deployment:

```powershell
Invoke-RestMethod 'https://cinnai.wittymushroom-238da769.centralindia.azurecontainerapps.io/health'
az containerapp show -g cinnai-666a84-rg -n cinnai --query '{image:properties.template.containers[0].image,ready:properties.latestReadyRevisionName,latest:properties.latestRevisionName}' -o json
```

Match the image and revision with the Windows checkout `release-result.json`. Review Docker/model artifacts under `.ci-reports/docker`, PostgreSQL integration output, lint/types and frontend/backend test results. Health alone does not prove the required tests ran.

```powershell
docker compose -f $compose --profile agent stop
docker compose -f $compose --profile agent up -d
```

Official references: [Jenkins Docker](https://www.jenkins.io/doc/book/installing/docker/), [JCasC secret files](https://github.com/jenkinsci/configuration-as-code-plugin/blob/master/docs/features/secrets.adoc), [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/).

### Transfer storage and activation

Read-only verification on 2026-11-06: the Windows identity has effective `*` actions with no exclusions at the ACR, app and environment scopes. ACR uses LegacyRegistryPermissions. This permits the required management/push actions; a future policy or expired login can still reject an operation. No permission grants were changed.

The initial tagged revision is now supported by baseline.ps1: only cinnai--0000004 with cloud-af7814c, resolving to the recorded OCI digest, with tag/index/child locks verified on each release. The stored rollback target is the digest, not the tag. No app redeployment was required. Evidence is registry/revision metadata (unchanged tag timestamp preceding revision creation); no running replica digest was available.

Archives and manifests are downloaded under %LOCALAPPDATA%\CinnAI\releases in unique directories. Allow disk space for the image archive in Jenkins and Windows plus Docker storage. Jenkins retains five artifact sets. Windows archives are retained for audit; manually remove old UUID download folders when no release is running, keeping ledger.json. No Docker images or volumes are pruned on Windows. Registry credentials use an ACL-restricted temporary Docker config removed afterward; the existing Windows Azure CLI cache is untouched.

Review and merge these changes to main and push manually before activating the release job. Do not run a Development release. No service principal, certificate, Azure password or Entra registration is needed. Terraform remains a separate protected workflow; its credentials are not configured by this change.


## Evidence

Calibration, detector replay and historical validation documents are retained below.
They record past runs, not guarantees about the current deployment.

- [backend/DIAMETER_CALIBRATION.md](backend/DIAMETER_CALIBRATION.md)
- [backend/QUILL_EDGE_REFINEMENT.md](backend/QUILL_EDGE_REFINEMENT.md)
- [backend/docker/VALIDATION.md](backend/docker/VALIDATION.md)
- [backend/experiments/calibration_audit/REPORT.md](backend/experiments/calibration_audit/REPORT.md)
- [backend/experiments/shadow_v5/REPORT.md](backend/experiments/shadow_v5/REPORT.md)
- [docs/VALIDATION.md](docs/VALIDATION.md)
- [infrastructure/jenkins/local/VALIDATION.md](infrastructure/jenkins/local/VALIDATION.md)
