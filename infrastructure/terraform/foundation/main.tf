locals {
  prefix = "cinnai-${var.name_suffix}"
  tags   = { project = "CinnAI", purpose = "student-fyp" }
}
data "azurerm_client_config" "current" {}
resource "azurerm_resource_group" "app" {
  name     = "${local.prefix}-rg"
  location = var.location
  tags     = local.tags
  lifecycle {
    precondition {
      condition     = var.subscription_reviewed && contains(var.allowed_locations, var.location)
      error_message = "Subscription eligibility/region/quota review is required before any resource creation."

    }

  }
}
resource "azurerm_user_assigned_identity" "app" {
  name                = "${local.prefix}-identity"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  tags                = local.tags
}
resource "azurerm_log_analytics_workspace" "optional" {
  count               = var.enable_log_analytics ? 1 : 0
  name                = "${local.prefix}-logs"
  location            = var.location
  resource_group_name = azurerm_resource_group.app.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.1
  tags                = local.tags
}
resource "azurerm_container_app_environment" "app" {
  name                       = "${local.prefix}-env"
  location                   = var.location
  resource_group_name        = azurerm_resource_group.app.name
  logs_destination           = var.enable_log_analytics ? "log-analytics" : null
  log_analytics_workspace_id = try(azurerm_log_analytics_workspace.optional[0].id, null)
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"

  }
  tags = local.tags
}
resource "azurerm_container_registry" "optional" {
  count               = var.enable_acr ? 1 : 0
  name                = "cinnai${var.name_suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  sku                 = var.acr_sku
  admin_enabled       = false
  tags                = local.tags
  lifecycle {
    precondition {
      condition     = (var.acr_student_benefit_confirmed && var.acr_sku == "Standard") || var.acr_paid_cost_approved
      error_message = "ACR is not automatically free: verify Standard student benefit or explicitly approve its cost."

    }

  }
}
resource "azurerm_role_assignment" "pull" {
  count                = var.enable_acr ? 1 : 0
  scope                = azurerm_container_registry.optional[0].id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
resource "azurerm_role_assignment" "push" {
  count                = var.enable_acr && var.jenkins_object_id != null ? 1 : 0
  scope                = azurerm_container_registry.optional[0].id
  role_definition_name = "AcrPush"
  principal_id         = var.jenkins_object_id
}
resource "azurerm_key_vault" "app" {
  count                      = var.enable_key_vault ? 1 : 0
  name                       = "${local.prefix}-kv"
  location                   = var.location
  resource_group_name        = azurerm_resource_group.app.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
  tags                       = local.tags
}
resource "azurerm_role_assignment" "secret_reader" {
  count                = var.enable_key_vault ? 1 : 0
  scope                = azurerm_key_vault.app[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
# No secret values are managed by Terraform; provision Gemini through a separately
# approved Key Vault operation. The app consumes a URI, never a plan/state plaintext.
resource "azurerm_postgresql_flexible_server" "optional" {
  count                         = var.enable_postgres ? 1 : 0
  name                          = "${local.prefix}-pg"
  location                      = var.location
  resource_group_name           = azurerm_resource_group.app.name
  version                       = "16"
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  auto_grow_enabled             = false
  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = true
  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = data.azurerm_client_config.current.tenant_id

  }
  tags = local.tags
  lifecycle {
    precondition {
      condition     = var.postgres_free_offer_confirmed && var.postgres_admin_object_id != null && var.postgres_admin_name != null
      error_message = "PostgreSQL is unused by current backend. Confirm 12-month offer and Entra admin before enabling."

    }

  }
}
resource "azurerm_postgresql_flexible_server_active_directory_administrator" "optional" {
  count               = var.enable_postgres ? 1 : 0
  server_name         = azurerm_postgresql_flexible_server.optional[0].name
  resource_group_name = azurerm_resource_group.app.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = var.postgres_admin_object_id
  principal_name      = var.postgres_admin_name
  principal_type      = var.postgres_admin_type
}
resource "azurerm_postgresql_flexible_server_firewall_rule" "optional" {
  for_each         = var.enable_postgres ? var.postgres_allowed_ipv4 : toset([])
  name             = "client-${replace(each.value, ".", "-")}"
  server_id        = azurerm_postgresql_flexible_server.optional[0].id
  start_ip_address = each.value
  end_ip_address   = each.value
}
resource "azurerm_consumption_budget_subscription" "student" {
  count           = var.enable_budget ? 1 : 0
  name            = "${local.prefix}-monthly"
  subscription_id = "/subscriptions/${var.subscription_id}"
  amount          = var.budget_usd
  time_grain      = "Monthly"
  time_period { start_date = var.budget_start_date }
  dynamic "notification" {
    for_each = toset([50, 80, 100])
    content {
      enabled        = true
      threshold      = notification.value
      operator       = "GreaterThanOrEqualTo"
      contact_emails = var.budget_emails

    }

  }
  lifecycle {
    precondition {
      condition     = length(var.budget_emails) > 0 && var.budget_usd > 0 && var.budget_usd <= 10
      error_message = "Supply alert email(s) and a monthly alert budget between 0 and 10 USD. Alerts are NOT hard caps."

    }

  }
}
