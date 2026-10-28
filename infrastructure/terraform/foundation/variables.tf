variable "subscription_id" { type = string }
variable "location" { type = string }
variable "name_suffix" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]{6}$", var.name_suffix))
    error_message = "Choose a six-character lowercase alphanumeric unique suffix."

  }
}
variable "allowed_locations" {
  type    = set(string)
  default = []
}
variable "subscription_reviewed" {
  type    = bool
  default = false
}
variable "enable_acr" {
  type    = bool
  default = true
}
variable "acr_sku" {
  type    = string
  default = "Standard"
  validation {
    condition     = contains(["Basic", "Standard"], var.acr_sku)
    error_message = "Only Basic/Standard registries are allowed."

  }
}
variable "acr_student_benefit_confirmed" {
  type    = bool
  default = true
}
variable "acr_paid_cost_approved" {
  type    = bool
  default = false
}
variable "jenkins_object_id" {
  type    = string
  default = null
}
variable "enable_key_vault" {
  type    = bool
  default = true
}
variable "enable_log_analytics" {
  type    = bool
  default = false
}
variable "enable_postgres" {
  type    = bool
  default = false
}
variable "postgres_free_offer_confirmed" {
  type    = bool
  default = false
}
variable "postgres_admin_object_id" {
  type    = string
  default = null
}
variable "postgres_admin_name" {
  type    = string
  default = null
}
variable "postgres_admin_type" {
  type    = string
  default = "User"
}
variable "postgres_allowed_ipv4" {
  type    = set(string)
  default = []
}
variable "enable_budget" {
  type    = bool
  default = true
}
variable "budget_usd" {
  type    = number
  default = 5
}
variable "budget_emails" {
  type    = list(string)
  default = []
}
variable "budget_start_date" { type = string }
