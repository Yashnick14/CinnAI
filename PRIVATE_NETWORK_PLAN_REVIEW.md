# Revised private PostgreSQL migration plan

29 October 2026. Supersedes POSTGRES_PLAN_REVIEW.md and the rejected 185-addition public-firewall plan. Development branch only. No Azure resource mutation, registration, apply, merge, push or deployment performed.

## Executed plans

- Foundation: 10 create, 0 change, 0 replace, 0 destroy; refreshed existing remote state, exit0.
- Application: 1 create, 0 change, 0 replace, 0 destroy; refreshed existing application and remote foundation state, exit0.
- Existing live environment, Container App, registry, identity, Key Vault, budget and Terraform backend remain untouched.
- Full review output: .test-tmp/private-plan/foundation.txt and application.txt. These are text review plans, not saved executable plans. The password was a discarded random planning value, not a real credential. Student eligibility remains a planning assumption based on the user's earlier portal confirmation; remaining eligibility period is still unverified. No persisted enablement flags were switched on.

## Exact additions

Foundation:
1. azurerm_virtual_network.private[0]: cinnai-666a84-vnet, 10.42.0.0/16.
2. azurerm_subnet.container_apps[0]: cinnai-apps, 10.42.0.0/27, delegated Microsoft.App/environments.
3. azurerm_subnet.postgres[0]: cinnai-postgres, 10.42.1.0/28, delegated Microsoft.DBforPostgreSQL/flexibleServers.
4. azurerm_private_dns_zone.postgres[0]: cinnai.postgres.database.azure.com.
5. azurerm_private_dns_zone_virtual_network_link.postgres[0]: link to new VNet, registration disabled.
6. azurerm_container_app_environment.private_candidate[0]: cinnai-666a84-private-env, external HTTPS-capable environment with only Consumption workload profile and the apps subnet. Existing cinnai-666a84-env remains.
7. azurerm_postgresql_flexible_server.optional[0]: cinnai-666a84-pg, PostgreSQL16, Central India, B_Standard_B1ms, 32768MB, seven-day backups, auto-grow and geo-backup disabled, private delegated subnet + DNS, public network access false.
8. azurerm_postgresql_flexible_server_database.cinnai[0]: cinnai.
9. azurerm_postgresql_flexible_server_configuration.tls[0]: require_secure_transport=on.
10. azurerm_postgresql_flexible_server_active_directory_administrator.optional[0]: existing operator identity.

Application:
11. azurerm_container_app.private_candidate[0]: cinnai-private, existing managed identity, ACR and Key Vault Gemini secret, approved main image digest ec3ba4e38dfae52f6d32fa5495f5f915bf6e85b3c165861aa7964c395c3cddfd, 1vCPU/2Gi, min0/max1. Cloud storage is independently disabled for the candidate in this first network-validation plan. Enabling it later does not require changing the live app's cloud flag.

No public PostgreSQL firewall resources, NAT Gateway, private endpoints, peering, VM, dedicated workload profile, VPN, DNS resolver or new registry/Key Vault are proposed. Azure additionally creates its managed infrastructure resource group and networking components for the environment; those are service-managed, billable artifacts and are NOT enumerated individually in Terraform's 11 additions.

## Why parallel migration is required

Azure cannot change an existing environment from platform networking to custom-VNet networking in place. Moving the current Container App to another environment would replace it. This plan avoids both destructive changes by creating separate Terraform addresses/names. The old endpoint remains live through validation and cutover; its eventual retirement is excluded and needs separate approval.

Internet phone/ESP32 -> candidate public HTTPS API -> private PostgreSQL IP within the VNet. TLS verify-full and database credentials remain required even over private networking. Database is not publicly reachable. ACR, Gemini, Firebase certificates and Key Vault remain reachable through the environment's platform-managed internet egress; no static egress is needed for database traffic. No forced-tunnel/NSG outbound restrictions are added in this minimal isolated VNet. The only workload subnet is the candidate app subnet; database access also requires authenticated database roles.

Current resource-group inspection found no existing VNets. Proposed nonoverlapping ranges avoid ACA reserved ranges. Any future peering/corporate network integration must recheck address overlap.

## Cost correction and estimate

The previous suggestion that private DNS was the only incremental network charge was incomplete. Microsoft documents managed public IPs and a standard load balancer for a custom-VNet external workload-profile environment.

Conservative 730-hour monthly estimate, USD, before any specifically verified networking benefits:
- Standard load balancer base rules: $0.025/hour = $18.25.
- Two standard IPv4 addresses (ingress and egress): 2 x $0.005/hour = $7.30.
- First private DNS zone: approximately $0.50/month.
- Incremental fixed networking: approximately **$26.05/month**.
- Additional LB processed data $0.005/GB; private DNS queries $0.40/million; internet egress and Consumption compute/requests beyond free allowances extra. Actual managed-resource allocation/metering must be checked after an approved deployment. Do not assume the retail API's free LB meters apply to this subscription.
- PostgreSQL: $0.0245/hour B1ms +32 x $0.131 storage = approximately **$22.08/month** before benefits, excess backup $0.095/GB-month.
- Combined new fixed baseline: approximately **$48.13/month before PostgreSQL benefits**, or **$26.05/month if its compute/storage allowance fully applies**, plus usage and existing deployment costs. Figures are estimates, not a fixed bill or total account cost.

No NAT cost is included. Existing and candidate environments overlap temporarily; allowances are shared across the subscription, not duplicated per app. Both apps may run one replica simultaneously during testing. This private design is more reliable than dynamic-IP allowlisting, but it is NOT a free networking design and could consume $100 credit quickly. Review the existing $5 alert budget; it is not a hard spending cap. No budget change was made.

Sources checked: https://learn.microsoft.com/en-us/azure/container-apps/networking ; https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks (Managed resources section); https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private ; https://prices.azure.com/api/retail/prices . Retail API queried for Central India PostgreSQL/IP and Global standard LB rates.

## Safety gates and cutover sequence (not executed)

1. Approve architecture/cost explicitly; verify remaining student PostgreSQL allowance/expiry. Microsoft.Network is currently NotRegistered; its registration requires approval. Confirm quota/capacity for an additional environment and concurrent replicas. A successful plan does not reserve capacity.
2. Review/merge infrastructure into main separately. Securely prepare real admin credentials through the approved Key Vault process and protected TF_VAR injection. State and saved plans can contain that password: private RBAC storage, HTTPS, versioning and soft deletion remain essential.
3. Generate a fresh saved foundation plan with real secure inputs, recheck zero destructive actions, obtain apply approval. Create only the approved parallel private foundation.
4. Generate candidate application plan using the actual new foundation private_environment_id output, not a guessed ID. The current review used the deterministic expected ID because the environment does not exist yet. Apply only after approval; candidate has its own new HTTPS hostname.
5. Test candidate /health, existing main-image visual/diameter/assistant behavior, image digest and resources. Verify private DNS and database TCP/TLS connectivity from within the candidate environment. Windows/Jenkins cannot connect directly to this private DB. Use an approved short-lived migration execution inside the candidate environment (exec or a separately reviewed manual Container Apps Job); never temporarily expose PostgreSQL. No migration job/VM is included in this plan.
6. Review/merge/test the cloud-enabled code on main, provision least-privilege runtime credentials and Key Vault DSN, run Alembic inside the VNet, then update only candidate with the new immutable main image and private_candidate_cloud_enabled=true via a separately reviewed plan. Current published image predates the cloud integration and cannot validate those new endpoints.
7. Test Firebase ownership, history persistence, telemetry, reconnect/staleness and real phone/mobile-data usage. Only after these pass, approve frontend/firmware API URL cutover. Azure-generated app hostname changes; no automatic redirect or custom-domain migration is promised. Keep old endpoint available for rollback during the agreed period.
8. Retire the old environment/app only under a separate explicit approval and reviewed deletion plan after successful cutover. No retirement is in this plan.

## Local changes and validation

Modified foundation/main.tf (private database, removed firewall resource), variables.tf (removed allowlist variable), terraform.tfvars.example. Added foundation/private_network.tf and tests/private.tftest.hcl. Added application/private_candidate.tf; appended candidate-only variables in application/variables.tf. No application grading code, image, frontend, live resource or production configuration changed this turn.

Terraform fmt completed. Both roots validate. Two mocked infrastructure tests passed, including private PostgreSQL settings and separate retained legacy environment. Both real plans exited0 and show zero changes/deletions. No apply-ready credential-bearing binary plan was saved.
