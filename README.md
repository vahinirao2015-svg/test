# Daymark attendance — AWS ALB + EC2 + Aurora

Terraform configuration that provisions:

- An internet-facing **Application Load Balancer** with **static public Elastic IPs**
- A **backend pool** of **EC2** instances running the **Daymark** attendance web app
- **Aurora PostgreSQL Serverless v2** for attendance data (via Secrets Manager)

See [`terraform/README.md`](terraform/README.md) for architecture, cost estimate, prerequisites, and usage.

Application source lives in [`app/`](app/).
