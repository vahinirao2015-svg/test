resource "azurerm_application_gateway" "main" {
  name                = "appgw-${local.name_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags

  sku {
    name     = var.app_gateway_sku_name
    tier     = var.app_gateway_sku_tier
    capacity = var.app_gateway_capacity
  }

  gateway_ip_configuration {
    name      = "appgw-ip-config"
    subnet_id = azurerm_subnet.appgw.id
  }

  frontend_port {
    name = "frontend-port-http"
    port = 80
  }

  frontend_ip_configuration {
    name                 = "frontend-public-ip"
    public_ip_address_id = azurerm_public_ip.appgw.id
  }

  # Backend pool targets the Azure App Service via its public FQDN.
  backend_address_pool {
    name  = "backend-pool-appservice"
    fqdns = [local.app_service_hostname]
  }

  # Probe App Service using its hostname so the site accepts the request.
  probe {
    name                                      = "probe-appservice-http"
    protocol                                  = "Http"
    path                                      = "/"
    interval                                  = 30
    timeout                                   = 30
    unhealthy_threshold                       = 3
    pick_host_name_from_backend_http_settings = true
    match {
      status_code = ["200-399"]
    }
  }

  # Forward to App Service on HTTP and set the Host header to the App Service FQDN.
  backend_http_settings {
    name                                = "http-settings-appservice"
    cookie_based_affinity               = "Disabled"
    port                                = var.backend_http_port
    protocol                            = "Http"
    request_timeout                     = 60
    pick_host_name_from_backend_address = true
    probe_name                          = "probe-appservice-http"
  }

  http_listener {
    name                           = "listener-http"
    frontend_ip_configuration_name = "frontend-public-ip"
    frontend_port_name             = "frontend-port-http"
    protocol                       = "Http"
  }

  request_routing_rule {
    name                       = "rule-http-to-appservice"
    rule_type                  = "Basic"
    http_listener_name         = "listener-http"
    backend_address_pool_name  = "backend-pool-appservice"
    backend_http_settings_name = "http-settings-appservice"
    priority                   = 100
  }

  depends_on = [
    azurerm_windows_web_app.web,
    azurerm_linux_web_app.web,
  ]
}
