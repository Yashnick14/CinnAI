mock_provider "azurerm" {}
override_data {
  target = data.terraform_remote_state.foundation
  values = { outputs = {
    resource_group_name = "cinnai-test-rg"
    environment_id      = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.App/managedEnvironments/test"
    identity_id         = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.ManagedIdentity/userAssignedIdentities/test"
    acr_login_server    = "test.azurecr.io"
    key_vault_uri       = "https://test.vault.azure.net/"
  } }
}
variables {
  subscription_id                = "00000000-0000-0000-0000-000000000001"
  state_resource_group           = "test"
  state_storage_account          = "test"
  image                          = "test.azurecr.io/backend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  allowed_ingress_cidrs          = ["192.0.2.1/32"]
  ephemeral_capture_acknowledged = true
}
run "offline_plan" {
  command = plan
  assert {
    condition     = azurerm_container_app.api.template[0].max_replicas == 1 && azurerm_container_app.api.template[0].min_replicas == 0
    error_message = "Replica guard changed."
  }
}
