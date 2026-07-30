locals {
  is_linux             = var.app_service_os_type == "Linux"
  is_shared_sku        = contains(["F1", "D1"], var.app_service_sku)
  web_app_name         = "app-${local.name_prefix}-${substr(md5(azurerm_resource_group.main.name), 0, 6)}"
  app_service_hostname = local.is_linux ? azurerm_linux_web_app.web[0].default_hostname : azurerm_windows_web_app.web[0].default_hostname
  app_service_name     = local.is_linux ? azurerm_linux_web_app.web[0].name : azurerm_windows_web_app.web[0].name
}

resource "azurerm_service_plan" "main" {
  name                = "asp-${local.name_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = var.app_service_os_type
  sku_name            = var.app_service_sku
  tags                = var.tags

  lifecycle {
    # Linux App Service has no Free/Shared tier. F1/D1 on Linux still needs
    # dedicated workers and fails with Total VMs quota = 0.
    precondition {
      condition     = !(local.is_linux && local.is_shared_sku)
      error_message = "Linux App Service does not support F1/D1. Use Windows + F1 (default) for zero VM quota, or Linux + B1 after requesting compute quota."
    }
  }
}

resource "azurerm_windows_web_app" "web" {
  count = local.is_linux ? 0 : 1

  name                = local.web_app_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = false
  tags                = var.tags

  site_config {
    always_on = !local.is_shared_sku

    application_stack {
      current_stack = "node"
      node_version  = "~20"
    }
  }

  app_settings = {
    WEBSITE_NODE_DEFAULT_VERSION = "~20"
  }
}

resource "azurerm_linux_web_app" "web" {
  count = local.is_linux ? 1 : 0

  name                = local.web_app_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = false
  tags                = var.tags

  site_config {
    always_on = !local.is_shared_sku

    application_stack {
      node_version = "20-lts"
    }
  }

  app_settings = {
    WEBSITE_NODE_DEFAULT_VERSION = "~20"
  }
}
