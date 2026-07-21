# Kubernetes deployment for AssetLedger

This app uses **SQLite on a persistent volume**. That drives the Kubernetes design:

| Constraint | Kubernetes choice |
|------------|-------------------|
| One writer only | `replicas: 1` |
| Avoid two pods on same disk during upgrade | `strategy: Recreate` |
| Durable inventory data | `PersistentVolumeClaim` (`ReadWriteOnce`) |
| Auth-safe probes | Probe `/api/health` (not `/api/assets`) |

---

## Deployment strategies (pick one)

### 1) Manual / scripted (`kubectl` + Kustomize) — simplest

```bash
# 1. Set your image registry in overlays (replace OWNER)
cd deploy/k8s/overlays/prod
kustomize edit set image ghcr.io/OWNER/assetledger=ghcr.io/<org>/<repo>/assetledger:TAG

# 2. Create namespace + secret once
kubectl create ns assetledger --dry-run=client -o yaml | kubectl apply -f -
kubectl -n assetledger create secret generic assetledger-secrets \
  --from-literal=AUTH_SECRET="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Apply
kubectl apply -k deploy/k8s/overlays/prod
kubectl -n assetledger rollout status deployment/assetledger
```

**Upgrade strategy used:** `Recreate`  
Pod is stopped, then the new pod starts with the same PVC. Brief downtime; safe for SQLite.

---

### 2) CI/CD automation (GitHub Actions) — recommended default

Workflows included:

| Workflow | Purpose |
|----------|---------|
| `.github/workflows/ci-build.yml` | Build Docker image → push to **GHCR** |
| `.github/workflows/cd-deploy.yml` | Apply Kustomize overlay to your cluster |

**One-time setup**

1. Create a GitHub Environment named `prod` (and optionally `dev`).
2. Add secret **`KUBE_CONFIG`** (base64 or raw kubeconfig) to that environment.
3. Ensure the cluster can pull from GHCR (imagePullSecrets if the repo is private).
4. Edit overlay hostnames under `deploy/k8s/overlays/*/ingress-patch.yaml`.

**Flow**

```text
git push → CI builds/pushes image → CD applies kustomize → rollout status → health smoke test
```

Manual deploy: Actions → **CD — Deploy to Kubernetes** → choose `dev`/`prod` + image tag.

---

### 3) GitOps (Argo CD) — best for continuous automation

1. Install [Argo CD](https://argo-cd.readthedocs.io/).
2. Edit `deploy/k8s/argocd-application.yaml` (`repoURL`, path, destination).
3. Apply:

```bash
kubectl apply -f deploy/k8s/argocd-application.yaml
```

Argo CD watches Git and auto-syncs `deploy/k8s/overlays/prod`.

**Pattern:** CI only builds/pushes images; GitOps updates the image tag in the overlay (or use an image updater). Cluster state is always derived from Git.

---

### 4) Blue/green or canary — **not recommended while using SQLite**

Those strategies need **2+ pods** and/or shared writable storage. SQLite + `ReadWriteOnce` does not support that safely.

To enable blue/green later:

1. Move persistence to Postgres/MySQL (e.g. Amazon RDS).
2. Switch Deployment to `RollingUpdate`.
3. Scale replicas ≥ 2.
4. Add a canary controller (Argo Rollouts / Flagger).

---

### 5) AWS EKS + ECR (automated)

See **[deploy/aws/README.md](../../aws/README.md)** for Terraform + GitHub Actions OIDC deployment to Amazon EKS with ALB Ingress and gp3 EBS storage.

Overlay: `deploy/k8s/overlays/aws-prod`

---

## Strategy comparison

| Strategy | Downtime | Automation | Fits SQLite? |
|----------|----------|------------|--------------|
| Recreate (current manifests) | Short (seconds–minutes) | Yes | **Yes** |
| RollingUpdate | Near-zero | Yes | No (multi-pod risk) |
| GitOps (Argo CD) + Recreate | Short | Excellent | **Yes** |
| Blue/green / canary | Near-zero | Excellent | No (until shared DB) |

---

## Layout

```text
deploy/k8s/
  base/                 # shared manifests
  overlays/
    dev/                # smaller resources, inventory-dev.example.com
    prod/               # TLS annotations, larger PVC
  argocd-application.yaml
  README.md             # this file
```

---

## Required secrets / config

| Name | How |
|------|-----|
| `assetledger-secrets.AUTH_SECRET` | `kubectl create secret ...` (not applied from Git by default) |
| Ingress host | Edit overlay `ingress-patch.yaml` |
| Image name | `kustomize edit set image ...` or CD workflow |
| StorageClass | Set on PVC if cluster has no default |

---

## Verify

```bash
kubectl -n assetledger get pods,svc,ingress,pvc
kubectl -n assetledger logs deploy/assetledger -f
kubectl -n assetledger port-forward svc/assetledger 3000:80
curl http://localhost:3000/api/health
```

Login: `http://<ingress-host>/login`  
Default admin: `admin@assetledger.local` / `Admin123!` (change after first login).

---

## Backup the SQLite volume

```bash
POD=$(kubectl -n assetledger get pod -l app.kubernetes.io/name=assetledger -o jsonpath='{.items[0].metadata.name}')
kubectl -n assetledger cp "$POD:/app/data/inventory.db" ./inventory-$(date +%F).db
```

Schedule this with CronJob or your backup tool before production use.
