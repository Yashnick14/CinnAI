mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = { tenant_id = "00000000-0000-0000-0000-000000000003" }
  }
}
variables {
  subscription_id       = "00000000-0000-0000-0000-000000000001"
  location              = "centralindia"
  name_suffix           = "tst123"
  allowed_locations     = ["centralindia"]
  subscription_reviewed = true
  budget_start_date     = "2026-10-01T00:00:00Z"
  budget_emails         = ["test@example.com"]
}
run "offline_plan" {
  command = plan
  assert {
    condition     = azurerm_container_registry.optional[0].sku == "Standard" && length(azurerm_postgresql_flexible_server.optional) == 0
    error_message = "Approved student defaults changed."
  }
}

