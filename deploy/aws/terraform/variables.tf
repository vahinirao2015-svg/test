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

variable "cluster_admin_principal_arns" {
  description = <<-EOT
    IAM user/role ARNs granted EKS cluster admin (list nodes, deploy apps, etc.).
    The principal that ran `terraform apply` gets admin via enable_cluster_creator_admin_permissions.
    Add other principals here (e.g. your IAM user). Avoid root unless necessary for dev.
  EOT
  type        = list(string)
  default     = []
}

variable "enable_vpc_cni_prefix_delegation" {
  description = <<-EOT
    Enable VPC CNI prefix delegation so single-node clusters (e.g. t3.micro) can run more
    than the default ~4 pods. Required for Free Tier single-node EKS with CoreDNS, EBS CSI,
    and the ALB controller. Existing nodes must be recycled after enabling (see README).
  EOT
  type        = bool
  default     = true
}

variable "coredns_replica_count" {
  description = "CoreDNS addon replica count. Use 1 for single-node dev/Free Tier clusters."
  type        = number
  default     = 1

  validation {
    condition     = var.coredns_replica_count >= 1 && var.coredns_replica_count <= 10
    error_message = "coredns_replica_count must be between 1 and 10."
  }
}

variable "install_alb_controller" {
  description = <<-EOT
    Install AWS Load Balancer Controller via Helm. Set false to reduce kube-system pod count
    during initial bootstrap if addons are stuck Pending; re-enable after nodes are recycled
    with prefix delegation (terraform apply with install_alb_controller = true).
  EOT
  type        = bool
  default     = true
}
