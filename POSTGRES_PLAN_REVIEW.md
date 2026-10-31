# PostgreSQL plan review — 29 October 2026

No apply, infrastructure mutation, firewall update, branch merge, push or deployment performed. Branch remains Development.

## Real enabled foundation plan

Terraform plan refreshed all eight existing foundation resources through the remote backend, acquired/released its state lock successfully and exited 0.

**185 create, 0 change, 0 replace, 0 destroy.**

- azurerm_postgresql_flexible_server.optional[0]: cinnai-666a84-pg, Central India, PostgreSQL16, B_Standard_B1ms, 32768MB, seven-day backup retention, auto-grow off, geo-backup off, no HA.
- azurerm_postgresql_flexible_server_active_directory_administrator.optional[0]: current signed-in operator.
- azurerm_postgresql_flexible_server_database.cinnai[0]: cinnai, UTF8.
- azurerm_postgresql_flexible_server_configuration.tls[0]: require_secure_transport=on.
- 181 azurerm_postgresql_flexible_server_firewall_rule.optional entries: one exact IPv4 start=end rule per current Container App outbound address. Full names/IPs are in .test-tmp/postgres-plan/foundation.txt.

Existing resource group, environment, ACR, identity, Key Vault, role assignments and budget have no proposed changes. The application and state-storage bootstrap are separate Terraform roots and are not managed by this foundation plan.

This is a review-only plan, not a saved apply artifact. The previously user-confirmed free-offer flag was supplied only as a planning assumption; remaining eligibility was NOT verified. A random planning-only password existed in the child PowerShell environment and was discarded, not stored in Key Vault or an executable plan. The plan output redacts it. Actual provisioning needs a newly reviewed saved plan with a securely provisioned credential and agreed networking. Persisted enable_postgres remains false.

## State and protection

The foundation plan used live refresh, not -refresh=false. Application refresh-only inspection found normalized empty values: tags={}, command=[], args=[]. No image, sizing or endpoint drift was reported. Its persisted state is therefore not byte-for-byte current; no refresh apply was run because the user prohibited apply. Refresh-only output is .test-tmp/postgres-plan/application-refresh.txt.

State storage cinnaitf666a84: HTTPS enforced, minimum TLS1_2, public blob access disabled, shared-key authentication disabled. tfstate container publicAccess=null (private), Azure CLI identity could read it. Blob versioning enabled and soft-delete retention seven days. Public storage network endpoint remains enabled; access still requires identity authorization. This check does not certify that every inherited RBAC assignment is least privilege.

The future PostgreSQL admin password will be sensitive but still present in Terraform state. Key Vault does not remove that state exposure. Keep actual credentials out of tfvars, stdout, source and plan text; use protected environment injection, restrict state/blob RBAC, and protect any saved binary plans. Runtime receives a separate least-privilege DSN via Key Vault with sslmode=verify-full. No real PostgreSQL credential was created during this review.

## Free benefit and costs

Azure CLI confirms subscription 666a8489-014b-456e-8d3a-3b531503b1b3 is Enabled / Azure for Students. The prior portal evidence listed 750 B1ms hours, 32GB storage and 32GB backup. Consumption lots API returned Not Found; it did not provide expiry or remaining service allowance. Neither the offer name nor the enabled status establishes remaining free eligibility. Need current Free services and Education/Sponsorship benefit-expiry evidence before claiming a free deployment; no expiry date is inferred from repository dates.

Current Azure Retail API: Central India B1MS $0.0245/hour, flexible storage $0.131/GB-month, LRS backup $0.095/GB-month when billable. At 730h +32GB: $17.885+$4.192 = approximately $22.08/month before benefits, plus excess backup/egress. At 744h: approximately $22.42. If eligible allowances remain and usage stays within them, covered database compute/storage can be $0; that conditional estimate is not verified for the remaining benefit period. Existing services and frequent telemetry-driven Container Apps usage can still consume credit. Budget alerts are not spending caps.

## Networking decision

Existing environment vnetConfiguration=null, Consumption workload profile; app reports 181 outbound addresses. They are shared infrastructure addresses, not guaranteed dedicated static egress. Exact rules avoid unrestricted/all-Azure access, but a current IP snapshot cannot ensure future connectivity. Firewall-rule propagation and future address rotation can interrupt database access. Do not describe this as production-reliable networking.

Alternatives:
1. Current dynamic allowlist: no additional networking resource cost; only suitable if explicit acceptance of outage/maintenance risk. Refresh/review allowlist after platform changes; never automatically broaden to all Azure. Not recommended as durable production connectivity.
2. Migrate to a separately reviewed VNet-integrated Consumption environment with privately integrated PostgreSQL: avoids public database egress allowlisting. Basic VNet/subnets have no hourly resource charge; private DNS first zone roughly $0.50/month plus $0.40/million queries, potential peering/egress and overlap during migration. No dedicated paid DNS resolver is needed for a simple same-VNet design. Requires new environment/application migration and a different PostgreSQL plan; not included or authorized here. Existing environment cannot have its network type changed in place.
3. VNet-integrated environment plus NAT static egress and public PostgreSQL: NAT alone $0.045/hour (~$32.85/month at730h) +$0.045/GB processed, public IPv4 and egress charges. Same migration prerequisite. Poor fit for the student budget; not included.

Private Endpoint alone would not connect the current non-VNet app and has additional endpoint/DNS charges; not a standalone fix. No extra networking resource is in the generated plan.

## Before provisioning

Confirm remaining free period/allowance from the portal, choose networking with explicit risk/cost acceptance, validate regional creation capacity, securely provision the real administrator secret, and generate/review a fresh saved plan. Review inherited state RBAC and establish migration/runtime database roles. Approve any main merge separately. No existing resource replacement is proposed by this plan, but the safer networking alternatives require separate approval and migration planning.

Sources: https://learn.microsoft.com/en-us/azure/container-apps/networking ; https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking ; https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/azurestudents-subscription-disabled ; https://prices.azure.com/api/retail/prices
