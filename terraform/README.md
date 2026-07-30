# Azure Application Gateway + App Service (Terraform)

Deploys a public web application fronted by **Azure Application Gateway** with a backend pool targeting **Azure App Service**, exposed via a **Standard public IP**.

## Architecture

```
Internet
   |
   v
[Public IP] ---> [Application Gateway] ---> [Backend Pool: App Service FQDN]
                         |
                    HTTP listener :80
                    Probe + Host header from backend address
```

| Resource | Purpose |
|---|---|
| Resource Group | Container for all resources |
| Virtual Network + subnet | Dedicated subnet for Application Gateway |
| Public IP (Static, Standard) | Frontend entry point for the web app |
| App Service Plan + Linux Web App | Backend web application |
| Application Gateway (Standard_v2) | Routes public traffic to App Service |

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5
- Azure CLI logged in (`az login`) with rights to create resources
- An Azure subscription selected (`az account set --subscription <id>`)

## Quick start

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars as needed

terraform init
terraform plan
terraform apply
```

After apply, open the Application Gateway URL from outputs:

```bash
terraform output application_gateway_url
terraform output public_ip_address
```

## Quota troubleshooting

If `terraform apply` fails on `azurerm_service_plan` with:

`Unauthorized` / `Current Limit (Total VMs): 0`

your subscription has **no dedicated compute quota** in that region. Paid App Service SKUs (`B1`, `S1`, `P1v3`, …) need at least 1 VM of quota.

**Fix options:**

1. **Use Free SKU (default in this repo):** keep `app_service_sku = "F1"` — shared hosting, no dedicated VM quota.
2. **Request quota:** Azure Portal → Subscriptions → Usage + quotas → raise **App Service** / compute quota for the region, then set `app_service_sku = "B1"`.
3. **Try another region:** set `location` to a region where your subscription already has quota.

## Key configuration notes

1. **Backend pool** uses the App Service default hostname (FQDN), not a private IP.
2. **HTTP settings** set `pick_host_name_from_backend_address = true` so App Service receives the correct `Host` header.
3. **Health probe** also picks the host name from backend HTTP settings.
4. App Service `https_only` is `false` so the gateway can reach it on HTTP (port 80). For production, prefer HTTPS end-to-end and attach a certificate to the gateway listener.
5. Application Gateway **Standard_v2 / WAF_v2** requires a **Standard** SKU public IP.
6. Default App Service SKU is **F1** so low-quota / new subscriptions can deploy without requesting VM capacity first.

## Useful variables

See `variables.tf` and `terraform.tfvars.example`. Common ones:

| Variable | Default | Description |
|---|---|---|
| `location` | `eastus` | Azure region |
| `prefix` | `webapp` | Resource name prefix (2–12 chars) |
| `app_service_sku` | `F1` | App Service Plan SKU (`F1` avoids VM quota; use `B1+` after quota increase) |
| `app_gateway_sku_name` | `Standard_v2` | Gateway SKU (`WAF_v2` also supported) |
| `app_gateway_capacity` | `1` | Gateway instances |

## Destroy

```bash
terraform destroy
```

## Files

| File | Contents |
|---|---|
| `versions.tf` | Terraform & provider versions |
| `providers.tf` | AzureRM provider |
| `variables.tf` | Input variables |
| `networking.tf` | RG, VNet, subnet, public IP |
| `appservice.tf` | App Service Plan + Linux Web App |
| `appgateway.tf` | Application Gateway, backend pool, listener, rule |
| `outputs.tf` | Public IP, URLs, resource IDs |
