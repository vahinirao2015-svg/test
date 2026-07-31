# Daymark attendance on AWS ALB + EC2 + RDS

Terraform configuration that provisions an internet-facing **Application Load Balancer** with:

- **Static public Elastic IPs** (one per AZ) on the ALB
- A **target group backend pool** of EC2 instances running the **Daymark** attendance web app
- **RDS PostgreSQL** (`db.t4g.micro`) for attendance data
- VPC with public (ALB) and private (EC2 + RDS) subnets across two AZs

> **Note:** Standard Aurora clusters in a VPC are blocked on AWS Free Plan accounts
> (`FreeTierRestrictionError` / `WithExpressConfiguration`). This stack uses RDS
> PostgreSQL so private EC2 backends can reach the database inside the VPC.

## Architecture

```
Internet
   |
   v
[Elastic IPs] ---> [Application Load Balancer] ---> [EC2: Daymark Flask/gunicorn]
                         |                                    |
                    HTTP :80 (or HTTPS :443)            Private subnets
                    Health check /health                      |
                                                         [RDS PostgreSQL]
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
| RDS PostgreSQL | Employees + attendance records |
| Secrets Manager | DB credentials for the app |
| S3 (private) | Attendance app package downloaded at instance boot |

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5
- AWS credentials configured (`aws configure` or environment variables)
- IAM permissions to create VPC, EC2, ELB, RDS, S3, IAM roles, Secrets Manager, and Elastic IPs

## Quick start

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars if needed

terraform init
terraform plan
terraform apply
```

If a previous apply failed on Aurora, remove stale Aurora resources from state if needed, then re-apply:

```bash
terraform state list | grep -E 'rds_cluster|rds_cluster_instance' || true
# If listed and not in AWS, drop them from state:
# terraform state rm 'aws_rds_cluster.attendance'
# terraform state rm 'aws_rds_cluster_instance.attendance'
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
- Data persisted in RDS PostgreSQL

## Approximate monthly cost (us-east-1, 24/7, low traffic)

| Service | Estimate |
|---|---|
| Application Load Balancer | ~$16–22 |
| Elastic IPs (attached to ALB) | $0 |
| 2× t3.micro + 30 GB gp3 | ~$20 |
| 1× NAT Gateway | ~$32 |
| RDS PostgreSQL db.t4g.micro (20 GB) | ~$12–15 (often $0 in Free Tier) |
| Secrets Manager | ~$0.40 |
| **Total** | **~$80–90/month** (lower with Free Tier DB) |

## HTTPS (optional)

Set `certificate_arn` to an ACM certificate in the same region:

```hcl
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/UUID"
```

## Troubleshooting unhealthy targets / 502 Bad Gateway

1. Confirm `backend_port = 8080` and `health_check_path = "/health"` in `terraform.tfvars`.
2. After apply, wait 3–5 minutes for instance user-data to finish (Python deps + gunicorn).
3. On an instance (SSM Session Manager):

```bash
sudo tail -n 200 /var/log/attendance-bootstrap.log
sudo systemctl status attendance.service --no-pager
sudo journalctl -u attendance.service -n 100 --no-pager
curl -v http://127.0.0.1:8080/health
```

4. Target group health checks must reach EC2 security group port `backend_port` from the ALB security group.

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
| `database.tf` | RDS PostgreSQL + Secrets Manager |
| `app_deploy.tf` | S3 app package + EC2 IAM for S3/Secrets |
| `ec2.tf` | Backend EC2 instances + bootstrap |
| `alb.tf` | ALB, target group, listeners |
| `outputs.tf` | URLs, IPs, DB endpoint |
| `../app/` | Daymark Flask attendance application |
