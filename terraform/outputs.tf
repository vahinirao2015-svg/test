output "resource_group_name" {
  description = "Resource group containing the deployed resources."
  value       = azurerm_resource_group.main.name
}

output "public_ip_address" {
  description = "Public IP address of the Application Gateway (use this to reach the web app)."
  value       = azurerm_public_ip.appgw.ip_address
}

output "application_gateway_url" {
  description = "HTTP URL for the Application Gateway frontend."
  value       = "http://${azurerm_public_ip.appgw.ip_address}"
}

output "app_service_name" {
  description = "Name of the Azure App Service (web app)."
  value       = local.app_service_name
}

output "app_service_default_hostname" {
  description = "Default hostname of the App Service (backend pool target)."
  value       = local.app_service_hostname
}

output "app_service_direct_url" {
  description = "Direct App Service URL (bypasses Application Gateway)."
  value       = "https://${local.app_service_hostname}"
}

output "app_service_os_type" {
  description = "OS type of the App Service Plan."
  value       = var.app_service_os_type
}

output "application_gateway_id" {
  description = "Resource ID of the Application Gateway."
  value       = azurerm_application_gateway.main.id
}

output "backend_pool_fqdn" {
  description = "FQDN registered in the Application Gateway backend pool."
  value       = local.app_service_hostname
}
