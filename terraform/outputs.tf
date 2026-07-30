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
  description = "HTTP URL for the Application Load Balancer."
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
  description = "IDs of EC2 instances in the backend pool."
  value       = aws_instance.backend[*].id
}

output "backend_private_ips" {
  description = "Private IP addresses of EC2 backend instances."
  value       = aws_instance.backend[*].private_ip
}
