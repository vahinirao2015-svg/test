variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "prefix" {
  description = "Short name prefix used for resource naming."
  type        = string
  default     = "webapp"

  validation {
    condition     = can(regex("^[a-z0-9]{2,12}$", var.prefix))
    error_message = "prefix must be 2-12 lowercase alphanumeric characters."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (ALB). Must cover at least two AZs."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (EC2 backends). Must cover at least two AZs."
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for subnets. Leave empty to use the first two AZs in the region."
  type        = list(string)
  default     = []
}

variable "instance_type" {
  description = "EC2 instance type for backend pool members."
  type        = string
  default     = "t3.micro"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GiB. Must be >= the AMI snapshot size (Amazon Linux 2023 typically requires 30)."
  type        = number
  default     = 30

  validation {
    condition     = var.root_volume_size >= 30
    error_message = "root_volume_size must be at least 30 GiB for the default Amazon Linux 2023 AMI."
  }
}

variable "instance_count" {
  description = "Number of EC2 instances in the ALB target group (backend pool)."
  type        = number
  default     = 2

  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "instance_count must be between 1 and 10."
  }
}

variable "backend_port" {
  description = "Port the Daymark attendance app (gunicorn) listens on."
  type        = number
  default     = 8080
}

variable "health_check_path" {
  description = "HTTP path used by the ALB target group health check."
  type        = string
  default     = "/health"
}

variable "app_name" {
  description = "Brand name shown in the attendance web UI."
  type        = string
  default     = "Daymark"
}

variable "db_name" {
  description = "Aurora PostgreSQL database name."
  type        = string
  default     = "attendance"
}

variable "db_username" {
  description = "Aurora master username."
  type        = string
  default     = "attendance_admin"
}

variable "db_engine_version" {
  description = "Aurora PostgreSQL engine version. Leave empty to use the AWS default for aurora-postgresql."
  type        = string
  default     = ""
}

variable "db_min_capacity" {
  description = "Aurora Serverless v2 minimum ACU."
  type        = number
  default     = 0.5
}

variable "db_max_capacity" {
  description = "Aurora Serverless v2 maximum ACU."
  type        = number
  default     = 4
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN. When set, an HTTPS listener (443) is created and HTTP redirects to HTTPS."
  type        = string
  default     = ""
}

variable "ami_id" {
  description = "Optional AMI ID for EC2 instances. Leave empty to use the latest Amazon Linux 2023 AMI."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Optional EC2 key pair name for SSH. Leave empty to disable SSH key injection (use SSM instead)."
  type        = string
  default     = ""
}

variable "enable_ssh" {
  description = "Allow inbound SSH (22) to EC2 from ssh_cidr. Prefer SSM Session Manager in production."
  type        = bool
  default     = false
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH when enable_ssh is true."
  type        = string
  default     = "0.0.0.0/0"
}

variable "tags" {
  description = "Tags applied to all supported resources via the provider default_tags."
  type        = map(string)
  default = {
    Project   = "daymark-attendance"
    ManagedBy = "terraform"
  }
}
