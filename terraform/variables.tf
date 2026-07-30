variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Name of the resource group."
  type        = string
  default     = "rg-appgw-webapp"
}

variable "prefix" {
  description = "Short name prefix used for resource naming."
  type        = string
  default     = "webapp"

  validation {
    condition     = can(regex("^[a-z0-9]{2,12}$", var.prefix))
    error_message = "prefix must be 2-12 lowercase alphanumeric characters."
  }
}

variable "vnet_address_space" {
  description = "Address space for the virtual network."
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "appgw_subnet_prefix" {
  description = "CIDR for the Application Gateway subnet."
  type        = string
  default     = "10.0.1.0/24"
}

variable "app_service_sku" {
  description = <<-EOT
    App Service Plan SKU name.
    Use F1 (Free) when the subscription has no dedicated compute quota
    (error: Current Limit (Total VMs): 0). Use B1/P1v3 after requesting quota.
  EOT
  type        = string
  default     = "F1"
}

variable "app_service_os_type" {
  description = "App Service Plan OS type."
  type        = string
  default     = "Linux"

  validation {
    condition     = contains(["Linux", "Windows"], var.app_service_os_type)
    error_message = "app_service_os_type must be Linux or Windows."
  }
}

variable "app_gateway_sku_name" {
  description = "Application Gateway SKU name."
  type        = string
  default     = "Standard_v2"

  validation {
    condition     = contains(["Standard_v2", "WAF_v2"], var.app_gateway_sku_name)
    error_message = "app_gateway_sku_name must be Standard_v2 or WAF_v2."
  }
}

variable "app_gateway_sku_tier" {
  description = "Application Gateway SKU tier."
  type        = string
  default     = "Standard_v2"

  validation {
    condition     = contains(["Standard_v2", "WAF_v2"], var.app_gateway_sku_tier)
    error_message = "app_gateway_sku_tier must be Standard_v2 or WAF_v2."
  }
}

variable "app_gateway_capacity" {
  description = "Application Gateway instance capacity (autoscaling disabled). Use 1 for demos / low-quota subscriptions."
  type        = number
  default     = 1

  validation {
    condition     = var.app_gateway_capacity >= 1 && var.app_gateway_capacity <= 125
    error_message = "app_gateway_capacity must be between 1 and 125."
  }
}

variable "backend_http_port" {
  description = "Port used by Application Gateway to reach App Service."
  type        = number
  default     = 80
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default = {
    environment = "demo"
    managed_by  = "terraform"
  }
}
