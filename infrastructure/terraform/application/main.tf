data "terraform_remote_state" "foundation" {
  backend = "azurerm"
  config = {
    resource_group_name  = var.state_resource_group
    storage_account_name = var.state_storage_account
    container_name       = var.state_container
    key                  = var.foundation_state_key
    use_azuread_auth     = true
    subscription_id      = var.subscription_id

  }
}
locals { foundation = data.terraform_remote_state.foundation.outputs }
resource "azurerm_container_app" "api" {
  name                         = var.app_name
  resource_group_name          = local.foundation.resource_group_name
  container_app_environment_id = local.foundation.environment_id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  identity {
    type         = "UserAssigned"
    identity_ids = [local.foundation.identity_id]

  }
  registry {
    server   = local.foundation.acr_login_server
    identity = local.foundation.identity_id

  }
  secret {
    name                = "gemini-api-key"
    identity            = local.foundation.identity_id
    key_vault_secret_id = "${local.foundation.key_vault_uri}secrets/${var.gemini_secret_name}"

  }
  ingress {
    external_enabled           = true
    target_port                = 8000
    transport                  = "http"
    allow_insecure_connections = false
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
    dynamic "ip_security_restriction" {
      for_each = var.allowed_ingress_cidrs
      content {
        name             = "demo-${index(sort(tolist(var.allowed_ingress_cidrs)), ip_security_restriction.value)}"
        action           = "Allow"
        ip_address_range = ip_security_restriction.value

      }

    }

  }
  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas
    http_scale_rule {
      name                = "http"
      concurrent_requests = "1"
    }
    volume {
      name         = "runtime"
      storage_type = "EmptyDir"
    }
    container {
      name   = "backend"
      image  = var.image
      cpu    = var.cpu
      memory = var.memory
      volume_mounts {
        name = "runtime"
        path = "/var/lib/cinnai"
      }
      env {
        name        = "GEMINI_API_KEY"
        secret_name = "gemini-api-key"
      }
      dynamic "env" {
        for_each = {
          TEMP_VISUAL_UPLOAD_DIRECTORY = "/var/lib/cinnai/tmp"
          UPLOAD_DIRECTORY             = "/var/lib/cinnai/uploads"
          V5_COLLECTION_DIRECTORY      = "/var/lib/cinnai/evaluation"

        }
        content {
          name  = env.key
          value = env.value
        }

      }
      startup_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health"
        interval_seconds        = 10
        failure_count_threshold = 30
      }
      readiness_probe {
        transport        = "HTTP"
        port             = 8000
        path             = "/health"
        interval_seconds = 10
      }
      liveness_probe {
        transport        = "HTTP"
        port             = 8000
        path             = "/health"
        interval_seconds = 30
      }

    }

  }
  lifecycle {
    precondition {
      condition     = var.cpu == 1 && var.memory == "2Gi" && var.min_replicas == 0 && var.max_replicas == 1
      error_message = "Approved initial sizing is 1 CPU/2Gi and 0-1 replicas; review cost guard before changing."

    }
    precondition {
      condition     = can(regex("@sha256:[a-f0-9]{64}$", var.image))
      error_message = "Deploy an immutable tested image digest."

    }
    precondition {
      condition     = length(var.allowed_ingress_cidrs) > 0 || var.public_api_approved
      error_message = "Restrict ingress to demo public IPs or explicitly approve public API exposure."

    }
    precondition {
      condition     = var.ephemeral_capture_acknowledged
      error_message = "Uploads and diagnostics disappear on replica shutdown. Acknowledge or design persistence before deployment."

    }

  }
}
output "url" { value = "https://${azurerm_container_app.api.ingress[0].fqdn}" }
