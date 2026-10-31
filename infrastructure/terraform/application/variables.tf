variable "subscription_id" {
  type = string
}
variable "state_resource_group" {
  type = string
}
variable "state_storage_account" {
  type = string
}
variable "state_container" {
  type    = string
  default = "tfstate"
}
variable "foundation_state_key" {
  type    = string
  default = "foundation.tfstate"
}
variable "app_name" {
  type    = string
  default = "cinnai"
}
variable "image" {
  type = string
}
variable "cpu" {
  type    = number
  default = 1
}
variable "memory" {
  type    = string
  default = "2Gi"
}
variable "min_replicas" {
  type    = number
  default = 0
}
variable "max_replicas" {
  type    = number
  default = 1
}
variable "allowed_ingress_cidrs" {
  type    = set(string)
  default = []
}
variable "public_api_approved" {
  type    = bool
  default = false
}
variable "ephemeral_capture_acknowledged" {
  type    = bool
  default = false
}
variable "gemini_secret_name" {
  type    = string
  default = "gemini-api-key"
}

variable "enable_cloud_storage" {
  type    = bool
  default = false
}
variable "cloud_database_secret_name" {
  type    = string
  default = "cloud-database-url"
}
variable "firebase_project_id" {
  type    = string
  default = "cinnai-7f4af"
}
