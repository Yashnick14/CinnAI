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
variable "state_operator_object_id" { type = string }
variable "jenkins_object_id" {
  type    = string
  default = null
}
