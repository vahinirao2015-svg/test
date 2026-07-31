# Daymark attendance on AWS ALB + EC2 + Aurora

Terraform configuration that provisions an internet-facing **Application Load Balancer** with:

- **Static public Elastic IPs** (one per AZ) on the ALB
- A **target group backend pool** of EC2 instances running the **Daymark** attendance web app
- **Aurora PostgreSQL Serverless v2** for attendance data
- VPC with public (ALB) and private (EC2 + Aurora) subnets across two AZs

## Architecture

```
Internet
   |
   v
[Elastic IPs] ---> [Application Load Balancer] ---> [EC2: Daymark Flask/gunicorn]
                         |                                    |
                    HTTP :80 (or HTTPS :443)            Private subnets
                    Health check /health                      |
                                                         [Aurora PostgreSQL]
                                                         Secrets Manager
```

| Resource | Purpose |
|---|---|
| VPC + public/private subnets | Network isolation; ALB public, app + DB private |
| Internet Gateway + NAT Gateway | Inbound to ALB; outbound from EC2 |
| Elastic IPs | Static public IPs attached to the ALB |
| Application Load Balancer | Layer-7 HTTP/HTTPS entry point |
| Target group | Backend pool registering EC2 instances |
| EC2 (Amazon Linux 2023) | Runs Daymark attendance (Flask + gunicorn :8080) |
| Aurora PostgreSQL Serverless v2 | Employees + attendance records |
| Secrets Manager | DB credentials for the app |
| S3 (private) | Attendance app package downloaded at instance boot |

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5
- AWS credentials configured (`aws configure` or environment variables)
- IAM permissions to create VPC, EC2, ELB, RDS/Aurora, S3, IAM roles, Secrets Manager, and Elastic IPs

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

Open the ALB URL. First boot installs Python deps and may take a few minutes before targets become healthy.

### App features

- Check in / check out by employee code
- On-floor list and recent activity
- `/records` history page
- `/health` for ALB health checks
- Data persisted in Aurora PostgreSQL

## Approximate monthly cost (us-east-1, 24/7, low traffic)

| Service | Estimate |
|---|---|
| Application Load Balancer | ~$16–22 |
| Elastic IPs (attached to ALB) | $0 |
| 2× t3.micro + 30 GB gp3 | ~$20 |
| 1× NAT Gateway | ~$32 |
| Aurora Serverless v2 (0.5–4 ACU) | ~$45–50 |
| Secrets Manager | ~$0.40 |
| **Total** | **~$115–130/month** |

## HTTPS (optional)

Set `certificate_arn` to an ACM certificate in the same region:

```hcl
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/UUID"
```

## Updating the app

Change files under `../app`, then re-apply. A new app zip is uploaded to S3; EC2 `user_data` replacement recreates instances so they pull the new package.

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
| `database.tf` | Aurora Serverless v2 + Secrets Manager |
| `app_deploy.tf` | S3 app package + EC2 IAM for S3/Secrets |
| `ec2.tf` | Backend EC2 instances + bootstrap |
| `alb.tf` | ALB, target group, listeners |
| `outputs.tf` | URLs, IPs, DB endpoint |
| `../app/` | Daymark Flask attendance application |
