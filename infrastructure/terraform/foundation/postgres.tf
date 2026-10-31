# Optional; existing enable_postgres remains false until a separately approved plan.
resource "azurerm_postgresql_flexible_server_database" "cinnai" {
  count     = var.enable_postgres ? 1 : 0
  name      = "cinnai"
  server_id = azurerm_postgresql_flexible_server.optional[0].id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
resource "azurerm_postgresql_flexible_server_configuration" "tls" {
  count     = var.enable_postgres ? 1 : 0
  name      = "require_secure_transport"
  server_id = azurerm_postgresql_flexible_server.optional[0].id
  value     = "on"
}
