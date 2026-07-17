output "aws_region" {
  value = var.aws_region
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecr_repository_name" {
  value = aws_ecr_repository.app.name
}

output "github_actions_role_arn" {
  description = "Set as AWS_ROLE_ARN in GitHub repository secrets/variables"
  value       = var.enable_github_oidc ? aws_iam_role.github_actions[0].arn : null
}

output "deploy_commands" {
  value = <<-EOT
    aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}
    kubectl apply -k deploy/k8s/overlays/aws-prod
  EOT
}
