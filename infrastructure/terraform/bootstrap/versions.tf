terraform {
  required_version = ">= 1.13.0, < 2.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 4.67.0" }

  }
}
provider "azurerm" {
  features {
    key_vault { purge_soft_delete_on_destroy = false }

  }
  storage_use_azuread             = true
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
}
