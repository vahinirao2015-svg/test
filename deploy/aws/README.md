# AWS EKS — Automated deployment for AssetLedger

End-to-end automation to run AssetLedger on **Amazon EKS** with **ECR**, **ALB Ingress**, and **GitHub Actions** (OIDC — no long-lived AWS keys after bootstrap).

```text
GitHub push
   │
   ├─► Terraform (VPC + EKS + ECR + ALB controller + GitHub OIDC role)
   │
   └─► Build image → ECR → kubectl apply (aws-prod overlay) → ALB URL
```

---

## Architecture

| Component | AWS service | Notes |
|-----------|-------------|-------|
| Cluster | **EKS** | Managed node group (`t3.medium` default) |
| Image registry | **ECR** | `assetledger` repository |
| Load balancer | **ALB** | AWS Load Balancer Controller (Helm via Terraform) |
| Disk | **EBS gp3** | PVC for SQLite (`ReadWriteOnce`, 1 replica) |
| CI/CD auth | **IAM OIDC** | GitHub Actions assumes role — no static keys |
| App rollout | **Recreate** | Safe for SQLite single-writer |

---

## One-time bootstrap (manual)

### 1) Prerequisites

- AWS account with permissions to create VPC, EKS, ECR, IAM
- AWS CLI v2, Terraform ≥ 1.6, kubectl
- GitHub repo with Actions enabled

### 2) Create GitHub Environment

In GitHub → **Settings → Environments**, create **`aws-prod`**.

Add **Variables**:

| Name | Example |
|------|---------|
| `AWS_REGION` | `us-east-1` |
| `EKS_CLUSTER_NAME` | `assetledger` |
| `ECR_REPOSITORY` | `assetledger` |

Add **Secrets** (bootstrap — first Terraform run only):

| Secret | Purpose |
|--------|---------|
| `AWS_TERRAFORM_ROLE_ARN` | IAM role with admin/poweruser for first `terraform apply` |

After Terraform completes, add:

| Secret | Value (from `terraform output`) |
|--------|----------------------------------|
| `AWS_ROLE_ARN` | `github_actions_role_arn` |

> **Bootstrap chicken-and-egg:** The GitHub OIDC deploy role is created *by* Terraform. Use an existing admin role (or access keys via a one-off local apply) for the **first** infrastructure run.

### 3) Local Terraform (first apply)

```bash
cd deploy/aws/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit github_org, github_repo, ingress_hostname, aws_region

terraform init
terraform plan
terraform apply
```

Save outputs:

```bash
terraform output github_actions_role_arn
terraform output ecr_repository_url
```

Set `AWS_ROLE_ARN` in GitHub to the OIDC role ARN.

### 4) DNS

After the app deploys, get the ALB hostname:

```bash
kubectl -n assetledger get ingress assetledger
```

Create a **CNAME** (or Route53 alias):

```text
inventory.example.com  →  k8s-assetledg-xxxxx.us-east-1.elb.amazonaws.com
```

Edit `deploy/k8s/overlays/aws-prod/ingress-patch.yaml` with your hostname.

---

## Automated workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **AWS — Provision EKS Infrastructure** | Manual / Terraform file changes | `terraform plan` or `apply` / `destroy` |
| **AWS — Deploy to EKS** | Push to `main` / manual | Build → ECR → `kubectl apply -k deploy/k8s/overlays/aws-prod` |

### Typical flow after bootstrap

```text
1. Actions → AWS — Provision EKS Infrastructure → apply   (once, or when infra changes)
2. Push code to main                                      → auto deploy to EKS
3. Open https://<your-host>/login
```

Manual deploy:

```text
Actions → AWS — Deploy to EKS → Run workflow
```

---

## Kustomize overlay

```bash
kubectl apply -k deploy/k8s/overlays/aws-prod
```

Includes:

- ALB Ingress annotations (`ingressClassName: alb`)
- `gp3` StorageClass PVC (20Gi)
- ECR image (rewritten by CI)

---

## Verify

```bash
aws eks update-kubeconfig --name assetledger --region us-east-1
kubectl -n assetledger get pods,svc,ingress,pvc
kubectl -n assetledger logs deploy/assetledger -f
curl -s http://localhost:3000/api/health   # via port-forward if needed
```

Login: `/login` — default admin `admin@assetledger.local` / `Admin123!` (change immediately).

---

## HTTPS with ACM (recommended)

1. Request a certificate in **ACM** for `inventory.example.com` (same region as ALB).
2. Uncomment HTTPS annotations in `deploy/k8s/overlays/aws-prod/ingress-patch.yaml`:

```yaml
alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80},{"HTTPS":443}]'
alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:ACCOUNT:certificate/UUID
alb.ingress.kubernetes.io/ssl-redirect: "443"
```

3. Re-apply: `kubectl apply -k deploy/k8s/overlays/aws-prod`

---

## Backup SQLite on EBS

```bash
POD=$(kubectl -n assetledger get pod -l app.kubernetes.io/name=assetledger -o jsonpath='{.items[0].metadata.name}')
kubectl -n assetledger cp "$POD:/app/data/inventory.db" "./inventory-$(date +%F).db"
```

Schedule with AWS Backup or a CronJob before production.

---

## Cost / scaling notes

- Default: 2× `t3.medium` nodes + NAT gateway (~$30–80/mo depending on region/traffic)
- SQLite → keep **1 replica**; scale vertically (larger nodes) if needed
- For HA / multi-AZ app tier, migrate to **RDS Postgres** and increase replicas

---

## Destroy (cleanup)

```bash
# Delete app first (releases PVC/LB)
kubectl delete -k deploy/k8s/overlays/aws-prod

# Then infrastructure
Actions → AWS — Provision EKS Infrastructure → destroy
# or locally:
cd deploy/aws/terraform && terraform destroy
```
