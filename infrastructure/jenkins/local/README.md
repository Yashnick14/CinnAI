# Local Jenkins for CinnAI

This is the current setup. Superseded remote-hosting instructions are quarantined under `delete/infrastructure/jenkins/` for manual review. Nothing here provisions Azure, merges branches, or removes existing Docker Desktop data.

## Start the controller

Run these commands from the project root in PowerShell with Docker Desktop in Linux mode:

```powershell
$compose = '.\infrastructure\jenkins\local\compose.yaml'
powershell.exe -ExecutionPolicy Bypass -File .\infrastructure\jenkins\local\set-secret.ps1 -Name admin-password
docker compose -f $compose config --quiet
docker compose -f $compose up -d --build controller
```

Open http://localhost:8080 and sign in as `cinnai-admin` with the password you entered. No setup-wizard password is needed. This password is managed by the secret file; update the file and recreate the controller when rotating it. Keep HTTP loopback-only; CSRF remains enabled.

## Register the Linux agent

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

## Isolation and credentials

- Controller: zero executors; no Docker socket/client certificate/daemon network; only loopback 8080 is published.
- Agent: separate Linux container; TLS client certificate for the private Docker daemon.
- Docker daemon: private `cinnai-ci_docker_data` volume. Existing host images, PostgreSQL containers and volumes are not mounted.
- Docker-in-Docker is privileged. This separates build storage; it is **not a security sandbox for hostile jobs**. Only the administrator may configure/build/replay jobs. Do not discover forks or PRs. Only your reviewed main/Development code may use this agent. Untrusted CI needs a separate disposable machine.
- Local Compose secrets are ACL-protected host files mounted read-only, not an encrypted vault. Never commit the secrets directory. Protect the Windows account/disk and encrypted backups.
- Named volumes persist Jenkins configuration, credentials, workspace and rollback ledger. Stop/up retains them; do not use `down -v`.
- Build retention: ten builds, five artifact sets. Cache cleanup only targets the private TLS CI daemon, unused builder cache older than seven days, retaining 10 GB. No host/global/volume pruning.

## Validate without Azure deployment

Before activating a release, run the local Linux validation command:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\infrastructure\jenkins\local\validate-local.ps1
```

This copies the working source into an isolated CI workspace, builds the agent and backend images, runs lint/types/frontend tests, script checks, Terraform mock tests, backend/model tests and disposable PostgreSQL migration/CRUD checks. It does not authenticate to Azure or use the user's database. Keep its final output. Compose config validation alone is not an end-to-end pass.

For ongoing development, create a trusted Multibranch Pipeline with script path `Jenkinsfile`. Discover only main and Development; disable fork/PR discovery. Leave LIVE_PLAN=false unless separately configured with read-only credentials. Do not give this job release credentials.

Models and fixtures are mounted read-only under `/opt/cinnai-inputs`; the pipeline copies only the three models, original FYP notebook and test images into a fresh checkout if missing. Docker verifies the existing model SHA256 manifest. AI assistant knowledge/embeddings come from Git. Missing required fixtures must fail validation.

## Configure the protected release job

Create folder `cinnai-production` with admin-only permissions. Store these credentials in that folder, not globally:

| ID | Jenkins kind | Value |
|---|---|---|
| cinnai-github-read | Username/password | GitHub username and repository-scoped read-only token; also used for remote-main checks |
| cinnai-release-client-id | Secret text | Dedicated Entra service principal application ID |
| cinnai-release-tenant-id | Secret text | Tenant ID |
| cinnai-release-certificate | Secret file | PEM private key and certificate matching the registered principal certificate |

Creating the principal/certificate and Azure role assignments requires separate approval; this setup creates none. Grant AcrPush only on `cinnai666a84`. Grant an app-scoped custom role with `Microsoft.App/containerApps/read`, `Microsoft.App/containerApps/write`, and `Microsoft.App/containerApps/revisions/read` on existing `cinnai`. Add environment read access only if required by Azure. Do not grant subscription Owner/Contributor, role-assignment, PostgreSQL administration, state-storage access or Key Vault secret-read to the release identity. App write permission is not field-restricted, so release pipeline editing must remain admin-only.

Create Pipeline `cinnai-production/cinnai-release`:

In Manage Jenkins → Tools, configure a Git installation named `Default` with executable `git`. The Git credential binding uses that name.

1. Pipeline script from SCM → Git → CinnAI repository with read-only Git credential.
2. Branch specifier `*/main`; script path `Jenkinsfile.release`.
3. No webhook, polling, timer, or PR triggers. Only admin can Build/Configure/Replay.
4. Jenkins must load the parameter definitions before using the trigger script. A first parameterless setup build deliberately fails before release if parameters were not loaded yet.

Azure and Docker login files use private temporary directories cleared after the release stage. Runtime application secrets remain in Azure; none enters the Docker image. The pipeline changes only the app image; it does not enable cloud feature flags or run production database migrations.

## Normal deployment

After you review, merge Development into main and push main, create a Jenkins API token under your user's Security page, then:

```powershell
$env:CINNAI_JENKINS_URL = 'http://localhost:8080'
$env:CINNAI_JENKINS_JOB_PATH = 'job/cinnai-production/job/cinnai-release'
.\scripts\deploy.ps1
```

Enter Jenkins username/API token in the credential prompt. Keep Docker and the laptop awake. Local main must match pushed main. Jenkins checks the requested SHA against checkout and remote main, runs all validation, publishes the tested image ID under the commit tag, resolves its immutable digest, updates the existing app and verifies the ready revision and HTTPS health endpoint. It refuses an already deployed digest to preserve rollback history. The script waits and prints the verified image, revision and URL. No automatic merge or Git push occurs.

## Rollback and infrastructure

```powershell
.\scripts\rollback.ps1
```

Rollback is a separately selected action on the protected main job. It deploys the previous digest as a new revision, verifies health, and refuses if the live image no longer matches the persistent ledger. It does not undo database migrations. Ledger: `/home/jenkins/agent/release/ledger.json`. A failed new deployment attempts restoration of the old image and still reports failure.

`Jenkinsfile.infrastructure` is a separate foundation-only main job with hashed plans and explicit human approval before apply. Leave it disabled unless needed. It needs separately scoped infrastructure credentials, current reviewed vars/backend files, and the `cinnai-infrastructure-linux` label. Do not reuse obsolete vars that disable the database. Ordinary deployment never invokes Terraform apply. Before a future application Terraform plan, set its reviewed image variable to the actual live digest to avoid reverting an image release.

```powershell
.\scripts\destroy-infrastructure.ps1 -PlanOnly
# Only after separate approval, backups and review:
# .\scripts\destroy-infrastructure.ps1 -Destroy
```

Destruction uses your interactive Azure CLI identity, scope checks and typed confirmations for application then foundation. Unmanaged resource-group contents stop deletion. Bootstrap/state storage remains protected and needs a separately reviewed retirement procedure. Never schedule destruction or give release credentials destruction permission.

## Verify and stop safely

After an authorized successful deployment:

```powershell
Invoke-RestMethod 'https://cinnai.wittymushroom-238da769.centralindia.azurecontainerapps.io/health'
az containerapp show -g cinnai-666a84-rg -n cinnai --query '{image:properties.template.containers[0].image,ready:properties.latestReadyRevisionName,latest:properties.latestRevisionName}' -o json
```

Match the image and revision with Jenkins `release-result.json`. Review Docker/model artifacts under `.ci-reports/docker`, PostgreSQL integration output, lint/types and frontend/backend test results. Health alone does not prove the required tests ran.

```powershell
docker compose -f $compose --profile agent stop
docker compose -f $compose --profile agent up -d
```

Official references: [Jenkins Docker](https://www.jenkins.io/doc/book/installing/docker/), [JCasC secret files](https://github.com/jenkinsci/configuration-as-code-plugin/blob/master/docs/features/secrets.adoc), [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/).
