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
| Cluster | **EKS** | Managed node group (`t3.micro` default — Free Tier eligible) |
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

terraform init -upgrade
terraform plan
terraform apply
```

> **Note:** This stack uses **EKS module v21** + **AWS provider v6**, which removes the
> deprecated `resolve_conflicts` addon attribute (replaced by
> `resolve_conflicts_on_create` / `resolve_conflicts_on_update`). Always run
> `terraform init -upgrade` after pulling these changes.

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

- **Free Tier EC2:** defaults use **`t3.micro`** (1 node). Copy `terraform.tfvars.free-tier.example` → `terraform.tfvars`.
- **Single-node pod limit:** `t3.micro` nodes default to **~4 pods** without VPC CNI prefix delegation. This stack enables **prefix delegation** by default (`enable_vpc_cni_prefix_delegation = true`) and sets **CoreDNS to 1 replica** so system addons can schedule. After changing prefix delegation on an existing cluster, **recycle worker nodes** so `--max-pods` increases (see troubleshooting below).
- **EKS control plane is NOT Free Tier** (~$0.10/hr per cluster).
- **NAT Gateway is NOT Free Tier** (~$32/mo + data). Largest hidden cost in this stack.
- `t3.micro` has only **1 GiB RAM** — enough for dev; upgrade to `t3.small` when out of Free Tier.
- For production after trial: `t3.small` or `t3.medium`, `node_desired_size = 2`.

### Free Tier instance types (verify)

```bash
aws ec2 describe-instance-types \
  --filters Name=free-tier-eligible,Values=true \
  --query "InstanceTypes[?contains(InstanceType, 'micro')].InstanceType" \
  --region us-east-1
```

Typical results: `t2.micro`, `t3.micro`, `t4g.micro`

| Instance | AMI type | Free Tier? | Notes |
|----------|----------|------------|-------|
| `t3.micro` | `AL2023_x86_64_STANDARD` | Yes* | Default; tight RAM for EKS |
| `t4g.micro` | `AL2023_ARM_64_STANDARD` | Yes* | ARM; set in free-tier tfvars |
| `t3.medium` | `AL2023_x86_64_STANDARD` | **No** | Causes InvalidParameterCombination |

\*12-month Free Tier for new AWS accounts; 750 hrs/month per instance type.

```bash
cp terraform.tfvars.free-tier.example terraform.tfvars
terraform apply
```

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

---

## Troubleshooting

### Warning: Deprecated value `resolve_conflicts`

```text
Warning: Deprecated resource attribute "resolve_conflicts" used
  ... module.eks.aws_eks_addon.this["aws-ebs-csi-driver"].resolve_conflicts
```

**This means your local Terraform is still using AWS provider v5.**  
AWS provider **v6** removed `resolve_conflicts` entirely. The fixed code requires **AWS provider >= 6.52**.

#### Fix (Windows / PowerShell)

From `deploy\aws\terraform`:

```powershell
# 1. Pull latest code
git pull

# 2. Wipe old module/provider cache (required)
Remove-Item -Recurse -Force .terraform -ErrorAction SilentlyContinue
Remove-Item -Force .terraform.lock.hcl -ErrorAction SilentlyContinue

# 3. Re-init with upgrades (must show aws 6.x)
terraform init -upgrade

# 4. Confirm provider version
terraform version
terraform providers

# 5. Plan again — warning should be gone
terraform plan
```

You should see something like:

```text
provider[registry.terraform.io/hashicorp/aws] 6.55.0
```

If it still shows `5.x`, init did not upgrade — delete `.terraform` again and rerun `terraform init -upgrade`.

> This was only a **warning**, not a hard error. Older applies could succeed; after upgrading, the warning disappears.

### Error: `lookup eks.us-east-1.amazonaws.com: no such host`

```text
Error: waiting for EKS Node Group ... create: ... Get "https://eks.us-east-1.amazonaws.com/...":
dial tcp: lookup eks.us-east-1.amazonaws.com: no such host
```

**This is a network/DNS problem on the machine running Terraform**, not an EKS misconfiguration. Terraform lost connectivity to the AWS API while polling node group status.

#### Step 1 — Test DNS and HTTPS (Windows PowerShell)

```powershell
nslookup eks.us-east-1.amazonaws.com
nslookup eks.us-east-1.amazonaws.com 8.8.8.8
Test-NetConnection eks.us-east-1.amazonaws.com -Port 443
aws sts get-caller-identity
```

| Result | Meaning |
|--------|---------|
| `nslookup` fails | DNS issue (corporate DNS, VPN, offline) |
| `nslookup` works but `Test-NetConnection` fails | Firewall/proxy blocking AWS |
| `aws sts` fails | AWS CLI also cannot reach AWS — fix network first |

#### Step 2 — Common fixes

1. **Reconnect internet / VPN** (or disconnect VPN if it blocks AWS).
2. **Flush DNS cache (Windows):**
   ```powershell
   ipconfig /flushdns
   ```
3. **Use public DNS temporarily:** set adapter DNS to `8.8.8.8` and `1.1.1.1`.
4. **Corporate proxy:** set before running Terraform:
   ```powershell
   $env:HTTP_PROXY="http://proxy.company:8080"
   $env:HTTPS_PROXY="http://proxy.company:8080"
   ```
5. **Run Terraform from a machine with reliable AWS access** (e.g. GitHub Actions workflow **AWS — Provision EKS Infrastructure** on `ubuntu-latest`).

#### Step 3 — Resume after fixing network

The cluster may already exist; only the node group wait failed.

```powershell
cd deploy\aws\terraform
terraform refresh
terraform plan
terraform apply
```

Check node group in AWS:

```powershell
aws eks list-nodegroups --cluster-name assetledger --region us-east-1
aws eks describe-nodegroup --cluster-name assetledger --nodegroup-name <name-from-above> --region us-east-1
```

If the node group is `CREATE_FAILED` or stuck, delete it in the console (or `aws eks delete-nodegroup ...`) and run `terraform apply` again.

#### Step 4 — Avoid long local applies (optional)

Use GitHub Actions for infrastructure instead of your laptop:

1. Set `AWS_TERRAFORM_ROLE_ARN` in GitHub `aws-prod` environment.
2. Run **Actions → AWS — Provision EKS Infrastructure → apply**.

The runner has stable DNS to `*.amazonaws.com`.

### Error: `nodes is forbidden` / cannot list resource "nodes"

```text
User "arn:aws:iam::ACCOUNT_ID:root" cannot list resource "nodes" in API group "" at the cluster scope
```

You are signed in as an IAM principal that **does not have Kubernetes RBAC** on the cluster. Only the IAM identity that **created** the cluster (or principals explicitly granted access) can list nodes.

#### Quick fix (AWS CLI) — grant yourself cluster admin

Replace `ACCOUNT_ID` and cluster/region as needed:

```powershell
$CLUSTER = "assetledger"
$REGION  = "us-east-1"
$PRINCIPAL = "arn:aws:iam::357912269932:root"   # or arn:aws:iam::357912269932:user/YOUR_USER

aws eks create-access-entry `
  --cluster-name $CLUSTER `
  --principal-arn $PRINCIPAL `
  --type STANDARD `
  --region $REGION

aws eks associate-access-policy `
  --cluster-name $CLUSTER `
  --principal-arn $PRINCIPAL `
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy `
  --access-scope type=cluster `
  --region $REGION

aws eks update-kubeconfig --name $CLUSTER --region $REGION
kubectl get nodes
```

Wait ~30 seconds, then refresh the EKS console or rerun `kubectl`.

#### Fix via Terraform (persistent)

In `terraform.tfvars`:

```hcl
cluster_admin_principal_arns = [
  "arn:aws:iam::357912269932:root",
  # "arn:aws:iam::357912269932:user/admin",
]
```

Then:

```bash
terraform apply
```

#### Security note

Avoid using the **account root** for daily EKS access. Create an **IAM user** or **role** with admin, add that ARN to `cluster_admin_principal_arns`, and use it for `aws eks update-kubeconfig`.

### CoreDNS / addons stuck: `Too many pods`

```text
0/1 nodes are available: 1 Too many pods
```

On a **single `t3.micro` node**, the default pod limit is **~4**. A minimal EKS stack needs more:

| Pod | Count |
|-----|-------|
| VPC CNI (`aws-node`) | 1 (DaemonSet) |
| kube-proxy | 1 (DaemonSet) |
| EBS CSI node | 1 (DaemonSet) |
| EBS CSI controller | 1 |
| CoreDNS | 1–2 |
| ALB controller | 1 |

That exceeds 4 pods, so CoreDNS (and other addons) stay **Pending** with no preemption target.

#### Fix (new clusters)

Defaults in this repo address this:

```hcl
enable_vpc_cni_prefix_delegation = true   # raises max pods per node
coredns_replica_count            = 1        # one CoreDNS on single-node dev
```

Run `terraform apply` from `deploy/aws/terraform`.

#### Fix (existing cluster — immediate recovery)

**1. Apply Terraform** (or update addons via AWS CLI):

```bash
cd deploy/aws/terraform
terraform apply
```

Or manually:

```bash
CLUSTER=assetledger
REGION=us-east-1

aws eks update-addon --cluster-name "$CLUSTER" --addon-name vpc-cni --region "$REGION" \
  --configuration-values '{"env":{"ENABLE_PREFIX_DELEGATION":"true","WARM_PREFIX_TARGET":"1"}}' \
  --resolve-conflicts OVERWRITE

aws eks update-addon --cluster-name "$CLUSTER" --addon-name coredns --region "$REGION" \
  --configuration-values '{"replicaCount":1}' \
  --resolve-conflicts OVERWRITE
```

**2. Recycle the worker node** (required — `--max-pods` is set at node join time):

```bash
# Scale node group to 0, wait for termination, then back to 1
NODEGROUP=$(aws eks list-nodegroups --cluster-name "$CLUSTER" --region "$REGION" \
  --query 'nodegroups[0]' --output text)

aws eks update-nodegroup-config --cluster-name "$CLUSTER" --nodegroup-name "$NODEGROUP" \
  --region "$REGION" --scaling-config minSize=0,maxSize=3,desiredSize=0

# Wait until no nodes: kubectl get nodes
aws eks update-nodegroup-config --cluster-name "$CLUSTER" --nodegroup-name "$NODEGROUP" \
  --region "$REGION" --scaling-config minSize=1,maxSize=3,desiredSize=1
```

**3. Verify** after the new node is Ready:

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,MAXPODS:.status.capacity.pods
kubectl -n kube-system get pods
kubectl describe ds -n kube-system aws-node | grep -E 'ENABLE_PREFIX_DELEGATION|WARM_PREFIX_TARGET'
```

You should see **max pods > 4** (typically ~11 on `t3.micro` with prefix delegation) and CoreDNS **Running**.

**4. Optional — defer ALB controller** if pods are still Pending before node recycle:

```hcl
install_alb_controller = false
```

Apply, recover addons, recycle nodes, then set `install_alb_controller = true` and apply again. You can use `kubectl port-forward` until ALB is installed.

#### Production

For production, prefer **`node_desired_size = 2`** or **`t3.small`**+ so system and app pods are not constrained on one small node.
