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
| App Service Plan + Web App | Backend web application (Windows Free by default) |
| Application Gateway (Standard_v2) | Routes public traffic to App Service |

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5
- Azure CLI logged in (`az login`) with rights to create resources
- An Azure subscription selected (`az account set --subscription <id>`)

## Quick start

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Important: use Windows + F1 if your subscription has Total VMs quota = 0

terraform init
terraform plan
terraform apply
```

If you already have a `terraform.tfvars`, set:

```hcl
app_service_os_type = "Windows"
app_service_sku     = "F1"
```

Then re-run `terraform apply`.

After apply:

```bash
terraform output application_gateway_url
terraform output public_ip_address
```

## Quota troubleshooting

If `azurerm_service_plan` fails with:

`Unauthorized` / `Current Limit (Total VMs): 0`

### Why F1 + Linux still fails

**Linux App Service has no Free/Shared tier.** Plans start at Basic (`B1`) and always need dedicated compute quota. Setting `F1` with `Linux` still requires 1 VM of quota.

### Fix for zero VM quota

Use the defaults (already set in this repo):

```hcl
app_service_os_type = "Windows"
app_service_sku     = "F1"
```

Windows Free uses shared hosting and does not consume dedicated VM quota.

### Linux / paid SKUs

1. Azure Portal → Subscriptions → **Usage + quotas**
2. Request App Service / compute quota for your region (at least 1)
3. Then set:

```hcl
app_service_os_type = "Linux"
app_service_sku     = "B1"
```

## Key configuration notes

1. **Backend pool** uses the App Service default hostname (FQDN), not a private IP.
2. **HTTP settings** set `pick_host_name_from_backend_address = true` so App Service receives the correct `Host` header.
3. **Health probe** also picks the host name from backend HTTP settings.
4. App Service `https_only` is `false` so the gateway can reach it on HTTP (port 80). For production, prefer HTTPS end-to-end and attach a certificate to the gateway listener.
5. Application Gateway **Standard_v2 / WAF_v2** requires a **Standard** SKU public IP.
6. Default is **Windows + F1** so subscriptions with no compute quota can deploy.
7. SSL/TLS policy is set explicitly to **`AppGwSslPolicy20220101`** (TLS 1.2+). This replaces the deprecated default `AppGwSslPolicy20150501`. Use `AppGwSslPolicy20220101S` for the stricter variant.

## Useful variables

| Variable | Default | Description |
|---|---|---|
| `location` | `eastus` | Azure region |
| `prefix` | `webapp` | Resource name prefix (2–12 chars) |
| `app_service_os_type` | `Windows` | `Windows` (supports F1) or `Linux` (needs B1+) |
| `app_service_sku` | `F1` | `F1` for zero quota; `B1+` after quota increase |
| `app_gateway_sku_name` | `Standard_v2` | Gateway SKU (`WAF_v2` also supported) |
| `app_gateway_capacity` | `1` | Gateway instances |
| `app_gateway_ssl_policy_name` | `AppGwSslPolicy20220101` | Predefined TLS 1.2+ SSL policy |

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
| `appservice.tf` | App Service Plan + Windows/Linux Web App |
| `appgateway.tf` | Application Gateway, backend pool, listener, rule |
| `outputs.tf` | Public IP, URLs, resource IDs |
