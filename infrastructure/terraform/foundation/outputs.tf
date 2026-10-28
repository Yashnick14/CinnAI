output "resource_group_name" { value = azurerm_resource_group.app.name }
output "environment_id" { value = azurerm_container_app_environment.app.id }
output "identity_id" { value = azurerm_user_assigned_identity.app.id }
output "acr_login_server" { value = try(azurerm_container_registry.optional[0].login_server, null) }
output "acr_name" { value = try(azurerm_container_registry.optional[0].name, null) }
output "key_vault_uri" { value = try(azurerm_key_vault.app[0].vault_uri, null) }
output "postgres_fqdn" { value = try(azurerm_postgresql_flexible_server.optional[0].fqdn, null) }
