variable "aws_region" {
  description = "AWS region for EKS and ECR"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment label (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "assetledger"
}

variable "cluster_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.31"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.20.0.0/16"
}

variable "node_instance_types" {
  description = "EC2 instance types for the managed node group. Free Tier (12 mo): t3.micro, t2.micro, t4g.micro"
  type        = list(string)
  default     = ["t3.micro"]
}

variable "node_ami_type" {
  description = "EKS AMI type for nodes. Use AL2023_ARM_64_STANDARD with t4g.* (Graviton)"
  type        = string
  default     = "AL2023_x86_64_STANDARD"
}

variable "node_desired_size" {
  description = "Desired worker node count (use 1 for Free Tier / dev to minimize cost)"
  type        = number
  default     = 1
}

variable "ecr_repository_name" {
  description = "ECR repository name for the app image"
  type        = string
  default     = "assetledger"
}

variable "enable_github_oidc" {
  description = "Create IAM OIDC trust for GitHub Actions deploy role"
  type        = bool
  default     = true
}

variable "github_org" {
  description = "GitHub organization or user (for OIDC trust policy)"
  type        = string
  default     = "vahinirao2015-svg"
}

variable "github_repo" {
  description = "GitHub repository name (for OIDC trust policy)"
  type        = string
  default     = "test"
}

variable "ingress_hostname" {
  description = "Public hostname for the ALB Ingress (DNS must point to ALB after deploy)"
  type        = string
  default     = "inventory.example.com"
}
