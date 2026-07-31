output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.app.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer."
  value       = aws_lb.app.dns_name
}

output "alb_url" {
  description = "HTTP URL for the Daymark attendance app via the ALB."
  value       = "http://${aws_lb.app.dns_name}"
}

output "alb_public_ip_addresses" {
  description = "Static Elastic IP addresses attached to the ALB (one per AZ)."
  value       = aws_eip.alb[*].public_ip
}

output "target_group_arn" {
  description = "ARN of the EC2 backend target group (backend pool)."
  value       = aws_lb_target_group.backend.arn
}

output "backend_instance_ids" {
  description = "IDs of EC2 instances running the attendance app."
  value       = aws_instance.backend[*].id
}

output "backend_private_ips" {
  description = "Private IP addresses of EC2 backend instances."
  value       = aws_instance.backend[*].private_ip
}

output "db_cluster_endpoint" {
  description = "Aurora PostgreSQL cluster writer endpoint."
  value       = aws_rds_cluster.attendance.endpoint
}

output "db_secret_arn" {
  description = "Secrets Manager ARN with database credentials."
  value       = aws_secretsmanager_secret.db.arn
}

output "app_bucket" {
  description = "S3 bucket containing the deployed attendance app package."
  value       = aws_s3_bucket.app.bucket
}
