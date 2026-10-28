# Azure subscription preflight — 2026-10-28

## Approved registration completed
Azure for Students subscription 666a8489-014b-456e-8d3a-3b531503b1b3 is Enabled. Microsoft.App, Microsoft.Storage, Microsoft.ContainerRegistry, Microsoft.KeyVault and Microsoft.ManagedIdentity are all Registered. Only these approved subscription registrations were performed. Branch remains Development.

## Region and quota
Enforced sys.regionrestriction permits koreacentral, eastasia, indiasouthcentral, malaysiawest and centralindia. Provider metadata advertises Central India support for Container Apps/environments, storage accounts, registries, vaults and managed identities.

Live Central India Container Apps usage: Managed Environment Count 0 used / 1 allowed; Dedicated NCA100 GPUs 0 / 0; Session Pools 0 / 1; Express Environment Count 0 / 450; Sandbox Cores 0 / 10. GPU, sessions, express and sandbox quotas are not needed by this architecture. This query does not establish environment-level Consumption CPU quota. Check environment usages after separately approved environment creation; deployment capacity is not guaranteed by a plan.

Storage check-name succeeded for cinnaitf666a84. The earlier SubscriptionNotFound error no longer occurs after registration. Operator has inherited subscription Owner rights; do not give Jenkins this broad role by default.

## Real bootstrap plan
Successfully ran authenticated terraform plan with AzureRM automatic registration disabled. Saved locally to bootstrap/bootstrap.tfplan (Git-ignored). Result: 4 to add, 0 to change, 0 to destroy.

| Address | Name / purpose |
|---|---|
| azurerm_resource_group.state | cinnai-state-666a84, Central India |
| azurerm_storage_account.state | cinnaitf666a84, StorageV2 Standard Hot LRS |
| azurerm_storage_container.state | tfstate, private container |
| azurerm_role_assignment.operator_state | Storage Blob Data Contributor for current operator, storage-account scope |

HTTPS/TLS1.2, public blob access disabled, shared-key authentication disabled, OAuth enabled, versioning enabled, soft delete seven days. Account endpoint is public but data requires authorization; no paid private endpoint or networking resources. prevent_destroy protects the group/account. No Jenkins role until an identity is supplied. Saved plan is sensitive; do not publish it.

## Costs / limitations
Student-benefit evidence remains the user's portal report: ACR Standard 31 registry-days; PostgreSQL B1MS 750 hours, 32 GB storage and backup; Hot LRS blob 5 GB. Remaining balances/expiry have not been independently verified. The bootstrap uses only blob storage: expected capacity is small, but operations, retained versions, soft-deleted data and transfer can consume credit. Resource group/container/RBAC have no separate base charge. Registration itself has no usage charge. Do not promise zero cost; monitor the free-service meters. Full architecture estimates remain in DEPLOYMENT.md. PostgreSQL stays disabled.

No remaining known blocker to requesting approval for this four-resource bootstrap, but plan success does not guarantee apply: role propagation, policy changes, name contention and service capacity can still intervene. Real foundation/application plans require the state backend to exist. Its creation has NOT been approved or performed. Later checks include Consumption CPU quota, 1 CPU/2 GiB load validation, budget support, secret provisioning and benefit expiry.

## Local changes and verification
bootstrap/main.tf now explicitly specifies Hot to match the confirmed storage benefit. Ignored bootstrap/terraform.tfvars contains verified subscription/operator/region inputs and subscription_reviewed=true for bootstrap preflight only. Terraform formatting and bootstrap validation pass; the final plan contains Hot and four creates. No grading application files changed. No apply, resource creation, deployment, commit or push. A final resource-group list returned []. Jenkins remains CI/CD choice.
