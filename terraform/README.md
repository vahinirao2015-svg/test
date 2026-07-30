# AWS Application Load Balancer + EC2 Backend Pool

Terraform configuration that provisions an internet-facing **Application Load Balancer** (AWS equivalent of Azure Application Gateway) with:

- **Static public Elastic IPs** (one per AZ) on the ALB
- A **target group backend pool** of EC2 instances running nginx
- VPC with public (ALB) and private (EC2) subnets across two AZs

## Architecture

```
Internet
   |
   v
[Elastic IPs] ---> [Application Load Balancer] ---> [Target Group: EC2 instances]
                         |                                    |
                    HTTP :80 (or HTTPS :443)            Private subnets + nginx
                    Health checks                       Outbound via NAT Gateway
```

| Resource | Purpose |
|---|---|
| VPC + public/private subnets | Network isolation; ALB public, EC2 private |
| Internet Gateway + NAT Gateway | Inbound to ALB; outbound from EC2 |
| Elastic IPs | Static public IPs attached to the ALB |
| Application Load Balancer | Layer-7 HTTP/HTTPS entry point |
| Target group | Backend pool registering EC2 instances |
| EC2 (Amazon Linux 2023 + nginx) | Application backends |
| Security groups | ALB open 80/443; EC2 only accepts traffic from ALB |
| IAM instance profile (SSM) | Manage instances without public SSH |

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5
- AWS credentials configured (`aws configure` or environment variables)
- IAM permissions to create VPC, EC2, ELB, IAM roles, and Elastic IPs

## Quick start

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars if needed

terraform init
terraform plan
terraform apply
```

After apply:

```bash
terraform output alb_url
terraform output alb_public_ip_addresses
```

Open the ALB URL (or any Elastic IP on port 80). Targets may take 1–2 minutes to become healthy after nginx finishes installing.

## Approximate monthly cost (us-east-1, 24/7, low traffic)

| Service | Estimate |
|---|---|
| Application Load Balancer | ~$16–22 |
| Elastic IPs (attached to ALB) | $0 |
| 2× t3.micro + 8 GB gp3 | ~$16 |
| 1× NAT Gateway | ~$32 |
| **Total** | **~$65–75/month** |

## HTTPS (optional)

Set `certificate_arn` to an ACM certificate in the same region:

```hcl
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/UUID"
```

This creates an HTTPS listener (TLS 1.3/1.2) and redirects HTTP → HTTPS.

## Useful variables

| Variable | Default | Description |
|---|---|---|
| `aws_region` | `us-east-1` | AWS region |
| `prefix` | `webapp` | Resource name prefix (2–12 chars) |
| `instance_type` | `t3.micro` | EC2 size |
| `instance_count` | `2` | Backend pool size |
| `backend_port` | `80` | Port on EC2 |
| `certificate_arn` | `""` | ACM cert for HTTPS |
| `enable_ssh` | `false` | Open SSH on EC2 (prefer SSM) |

## Destroy

```bash
terraform destroy
```

## Files

| File | Contents |
|---|---|
| `versions.tf` | Terraform & provider versions |
| `providers.tf` | AWS provider |
| `variables.tf` | Input variables |
| `networking.tf` | VPC, subnets, IGW, NAT, Elastic IPs |
| `security_groups.tf` | ALB and EC2 security groups |
| `ec2.tf` | Backend EC2 instances, IAM, target attachments |
| `alb.tf` | ALB, target group, listeners |
| `outputs.tf` | URLs, IPs, instance IDs |
