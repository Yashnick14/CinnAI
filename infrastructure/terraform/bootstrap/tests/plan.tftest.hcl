mock_provider "azurerm" {}
variables {
  subscription_id          = "00000000-0000-0000-0000-000000000001"
  location                 = "centralindia"
  name_suffix              = "tst123"
  allowed_locations        = ["centralindia"]
  subscription_reviewed    = true
  state_operator_object_id = "00000000-0000-0000-0000-000000000002"
}
run "offline_plan" {
  command = plan
  assert {
    condition     = azurerm_storage_account.state.account_replication_type == "LRS"
    error_message = "Approved student defaults changed."
  }
}
