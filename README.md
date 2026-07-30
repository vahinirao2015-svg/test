# AWS Application Load Balancer + EC2 Backend

Terraform configuration that provisions:

- An internet-facing **Application Load Balancer** (AWS equivalent of Azure Application Gateway)
- A **backend pool** (target group) of **EC2** instances running nginx
- **Static public Elastic IPs** attached to the ALB

See [`terraform/README.md`](terraform/README.md) for architecture, cost estimate, prerequisites, and usage.
