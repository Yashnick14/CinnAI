# Manual, separately approved bootstrap. Its local state must be kept private/backed up.
resource "azurerm_resource_group" "state" {
  name     = "cinnai-state-${var.name_suffix}"
  location = var.location
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.subscription_reviewed && contains(var.allowed_locations, var.location)
      error_message = "Confirm student offer, allowed region and bootstrap storage cost first."

    }

  }
}
resource "azurerm_storage_account" "state" {
  name                            = "cinnaitf${var.name_suffix}"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = var.location
  account_tier                    = "Standard"
  access_tier                     = "Hot"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  default_to_oauth_authentication = true
  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 7 }

  }
  lifecycle { prevent_destroy = true }
}
resource "azurerm_role_assignment" "operator_state" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.state_operator_object_id
}
resource "azurerm_role_assignment" "jenkins_state" {
  count                = var.jenkins_object_id == null ? 0 : 1
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.jenkins_object_id
}
resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  depends_on            = [azurerm_role_assignment.operator_state]
}
output "backend_config" {
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.state.name
    use_azuread_auth     = true

  }
}

