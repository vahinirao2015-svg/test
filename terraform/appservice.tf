resource "azurerm_service_plan" "main" {
  name                = "asp-${local.name_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = var.app_service_os_type
  sku_name            = var.app_service_sku
  tags                = var.tags

  # F1/D1 use shared infrastructure and do not consume dedicated VM quota.
  # Paid SKUs (B1+) require regional compute quota > 0.
}

resource "azurerm_linux_web_app" "web" {
  name                = "app-${local.name_prefix}-${substr(md5(azurerm_resource_group.main.name), 0, 6)}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = false
  tags                = var.tags

  site_config {
    always_on = var.app_service_sku != "F1" && var.app_service_sku != "D1"

    application_stack {
      node_version = "20-lts"
    }

    # Accept traffic from Application Gateway using the App Service hostname.
    # Override host header handling is configured on the gateway HTTP settings.
  }

  # Minimal placeholder so the site responds to health probes out of the box.
  app_settings = {
    WEBSITE_NODE_DEFAULT_VERSION = "~20"
  }

  lifecycle {
    precondition {
      condition     = var.app_service_os_type == "Linux"
      error_message = "This configuration deploys a Linux web app. Set app_service_os_type to Linux."
    }
  }
}
