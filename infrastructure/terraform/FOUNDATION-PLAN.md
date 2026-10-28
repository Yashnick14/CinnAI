# Foundation plan for review — 2026-10-28

Real authenticated Terraform plan using existing Azure Blob remote backend succeeded: **8 to add, 0 to change, 0 to destroy**. No apply. Saved plan: foundation/foundation.tfplan (Git-ignored). Full rendered plan: foundation/foundation-plan.txt (Git-ignored).

Saved-plan SHA256: 9054c5dcc9a6241cb0a3d339adca2bf9a328f4fd4e135600eb84adefde0ef385.

## All proposed resources
| Terraform address | Name / purpose | Potential charge |
|---|---|---|
| azurerm_resource_group.app | cinnai-666a84-rg, Central India | No separate charge |
| azurerm_container_app_environment.app | cinnai-666a84-env, Consumption workload profile only | No dedicated capacity or management features enabled; app usage billed later |
| azurerm_container_registry.optional[0] | cinnai666a84, Standard, admin login disabled | Confirmed student Standard benefit; retail fallback $0.6666/day, about $20/30 days |
| azurerm_user_assigned_identity.app | cinnai-666a84-identity | No separate charge |
| azurerm_role_assignment.pull[0] | AcrPull for app identity on registry | No separate charge |
| azurerm_key_vault.app[0] | cinnai-666a84-kv, Standard/RBAC, 7-day soft delete | Secret operations retail $0.03/10,000; no secret populated by plan |
| azurerm_role_assignment.secret_reader[0] | Key Vault Secrets User for app identity | No separate charge |
| azurerm_consumption_budget_subscription.student[0] | cinnai-666a84-monthly; amount 5, monthly; 50/80/100% email alerts | No resource usage charge; notification only, NOT a spending cap |

Budget recipient is the user-supplied email in the ignored tfvars and full plan. Budget amount uses subscription billing currency; confirm currency when Azure creates it. Intended budget is US$5. Starts 2026-10-01. Budget API acceptance is not guaranteed by plan.

PostgreSQL, Log Analytics workspace and Jenkins identity/role are absent. No Container App, image upload, Gemini secret, GPU, VM, private endpoint, NAT or custom networking in this plan. Azure-managed platform resources may appear as part of environment provisioning; not separate user-managed Terraform entries. Existing bootstrap is a separate state and is unaffected.

## Checks and limits
Subscription enabled; Central India permitted and supported. Managed environment quota 0 used / 1 allowed. Five required providers registered. Registry name available. Existing Azure groups list contains only cinnai-state-666a84. Environment-specific Consumption CPU quota still needs checking after an approved environment exists. Plan success does not establish capacity or all service/billing eligibility.

Student free-service evidence is the user's portal report, including ACR Standard 31 registry-days. Verify remaining balances and expiry before apply. One registry, local Docker builds, no paid ACR Tasks. Minimal idle foundation should be near zero within benefits; no guarantee of zero invoice. Extra registry storage/egress, Key Vault operations and existing state storage operations/versions may use credit. No application compute yet. Future app at 1 CPU/2 GiB and 0-1 replicas: free CPU/RAM grants correspond to ~50 running hours/month; 60 hours is approximately $1.08 compute at the recorded Central India rates, plus requests/other usage. Budgets do not stop charges. Gemini costs are separate.

Pricing sources: https://prices.azure.com/api/retail/prices ; https://learn.microsoft.com/en-us/azure/container-apps/billing ; https://azure.microsoft.com/en-us/free/students

## Main-only deployment gate
Remote main verified at 66b03732723c14ab9cf019c1f9fb06c1ab59e2d5. Dockerfile/new Terraform currently exist only as uncommitted changes on Development; main does not contain them. This is a REVIEW-ONLY working-tree plan, not a deployable approved-main release. No checkout, commit, merge or push performed. Keep review and explicit approval before any apply. Before production deployment, review/commit/merge changes into main with separate authorization, check out exact approved main commit in a clean checkout, and regenerate/compare the foundation plan there before applying if enforcing main-only infrastructure releases too. Never build production from the dirty Development workspace.

## After approval / next stages
1. Resolve reviewed main provenance without automatic push/merge; verify the exact foundation plan remains approved before applying it.
2. Provision foundation only after explicit apply approval; check resulting environment quota and identities.
3. Securely populate Gemini secret through separately authorized access, without putting secret values in Git or image layers.
4. In a clean approved-main checkout, supply trusted model/knowledge assets, verify hashes, run backend/frontend tests and Linux inference. Validate 1 CPU/2 GiB under representative load (previous Linux suite used 2 CPU/4 GiB).
5. Build/test image from that main commit, publish only after approval with commit tag, record immutable registry digest.
6. Generate separate application plan: cinnai, Consumption, 1 CPU/2 GiB, min0/max1, PostgreSQL disabled. Review public ingress and ephemeral capture implications. Obtain separate application apply approval.
7. Deploy exact approved digest and verify health/inference. Jenkins can be configured later; no GitHub Actions required.

Local files this turn: foundation/terraform.tfvars (ignored), foundation.tfplan and rendered plan (ignored), this report, .gitignore plan-output pattern. No application/ML/calibration changes. No Azure resources created (only remote backend lock/state metadata operations required by plan).
