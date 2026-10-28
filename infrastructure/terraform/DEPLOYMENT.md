# Azure preparation: 28 October 2026

Development branch. No apply, resource creation or push.

Stacks: bootstrap (private OAuth LRS remote state and roles), foundation (Consumption environment, Standard ACR, managed identity, Key Vault, $5 budget alerts), application (1 CPU/2 GiB, min 0/max 1, immutable image, HTTPS health probes). PostgreSQL and Log Analytics disabled. PostgreSQL can later be enabled in foundation without moving existing resources: B1ms/32 GB, Entra-only auth, exact IP rules, 7-day backup, no HA or geo backups. Application database integration is separate.

## Region and cost
Proposed region centralindia, not yet verified against subscription policy/quota. No Azure CLI or authenticated Azure session available here. Check inherited allowed-locations policies, Microsoft.App regional quotas/capacity, provider registrations and benefit expiry before setting subscription_reviewed=true. Provider registration is intentionally disabled in Terraform.

User confirmed Standard ACR 31 registry-days, PostgreSQL 750 B1MS hours/32 GB storage/32 GB backup, Hot LRS blob 5 GB. Check remaining subscription-wide allowances and expiry before provisioning.

Central India Retail Prices API snapshot: ACA active CPU $0.000024/second and RAM $0.000003/GiB-second. Free shared monthly 180000 CPU-seconds/360000 GiB-seconds equals 50 running hours at 1 CPU/2 GiB. 30 running hours: $0 compute; 60: $1.08; 730: $73.44. Includes startup/cooldown, not just inference. First 2M requests free then $0.40/M. Persistent polling can prevent scale zero.

ACR Standard retail $0.6666/day (~$20/30 days), covered while matching confirmed benefit remains available. Build locally, avoid paid ACR Tasks. State capacity should fit 5 GB; operations, versions and egress need separate allowance checks. Key Vault operations $0.03/10000. Reserve up to $1/month for small state/secret operations as a planning allowance, not a guarantee. Demo target near $0-$1 within grants; traffic/other subscription workloads can add cost. Gemini charges are separate. Budget alerts are not hard spending caps. Keep student spending limit enabled.

Sources: https://prices.azure.com/api/retail/prices ; https://learn.microsoft.com/en-us/azure/container-apps/billing ; https://azure.microsoft.com/en-us/free/students

## Validation and approvals
Terraform 1.13.5/AzureRM 4.67.0. Keep lock files in Git.
Each stack: terraform init -backend=false; terraform validate; terraform test.
Root: terraform fmt -check -recursive.
Tests use mock providers and plan only, not Azure capacity/permission validation.

Copy examples to ignored terraform.tfvars and replace IDs. Gates intentionally remain closed. After read-only account checks and Azure login, plan bootstrap to a private saved plan; obtain separate approval before apply. Protect bootstrap local state and backups. Roles require creation/RBAC authority plus Blob Data Contributor; allow time for propagation.
After approved bootstrap exists, copy backend.hcl.example to local.backend.hcl; terraform init -reconfigure -backend-config=local.backend.hcl. Foundation and application use separate state keys. Plan foundation, obtain approval before apply. Populate Gemini secret through an authorized Key Vault administrator; never store its value in Git/tfvars/history. Build/test/push only with approval and use immutable digest for application. Plan application and request separate apply approval. Never publish plans/state.

Jenkins runs on Windows laptop, not Azure VM; no GitHub Actions. Prepare trusted Development checkout, backend/frontend tests and TypeScript, Docker inference, Terraform plan, human-approved saved-plan apply, approved push/deploy and bounded health check. Model binaries are ignored in Git; fresh Jenkins checkout needs trusted artifacts and sanitized fixtures. Do not publish original notebook outputs that may contain secrets. Use Jenkins credentials and scoped roles, not subscription Owner. Full pipeline execution remains pending Jenkins installation, artifacts and Azure credentials.

## Blockers
Region policy/quota, benefit expiry, account permissions and secret provisioning need verification. Validate 1 CPU/2 GiB under combined inference: prior run used 2 CPU/4 GiB with ~955 MiB peak RSS. Concurrent workloads can use more.
Uploads/diagnostics/CSV use ephemeral volume and disappear at scale zero; acknowledgement required. Export evidence or design persistence separately. State blob is not image storage. Check non-root volume write access during staging.
Backend is not secured by frontend Firebase login: use allowed demo IP CIDRs or explicitly approve public API. No secret values in Terraform.
After demos stop traffic for scale zero; ACR still consumes registry-days. After separate approval destroy application then foundation, exporting evidence first. State has prevent_destroy and requires explicit retirement approval/backups. Soft-deleted Key Vault names can remain reserved seven days.

Resource names use cinnai without environment labels. The Container App is cinnai; shared resources use cinnai plus the configured unique suffix and resource-type suffix. Registry and storage names retain required globally unique suffixes. Git branch remains Development.

## Updated branch policy
See ../jenkins/README.md and repository Jenkinsfile/Jenkinsfile.release. Development/development validates only (optional read-only Azure plan); only protected main releases can publish or apply after successful tests and explicit saved-plan approval. One shared environment; no branch-based Azure environments. Keep these changes on Development until reviewed and manually merged. The earlier preparation-only Jenkins description is superseded by this policy.
