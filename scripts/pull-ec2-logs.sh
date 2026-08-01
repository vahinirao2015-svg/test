#!/usr/bin/env bash
# Pull Daymark EC2 bootstrap/service logs from the app S3 bucket.
# Usage:
#   ./scripts/pull-ec2-logs.sh
#   ./scripts/pull-ec2-logs.sh my-bucket-name
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT}/.logs"
mkdir -p "${OUT_DIR}"

BUCKET="${1:-}"
if [[ -z "${BUCKET}" ]]; then
  if [[ -d "${ROOT}/terraform" ]]; then
    BUCKET="$(cd "${ROOT}/terraform" && terraform output -raw app_bucket 2>/dev/null || true)"
  fi
fi

if [[ -z "${BUCKET}" ]]; then
  echo "Usage: $0 <app-bucket-name>"
  echo "Or run from a terraform workspace that has output app_bucket."
  exit 1
fi

echo "Downloading s3://${BUCKET}/logs/ -> ${OUT_DIR}/"
aws s3 sync "s3://${BUCKET}/logs/" "${OUT_DIR}/"
echo
echo "Downloaded files:"
find "${OUT_DIR}" -type f | sort
echo
echo "---- Recent bootstrap tails ----"
for f in "${OUT_DIR}"/*/bootstrap.log; do
  [[ -f "$f" ]] || continue
  echo "===== $f ====="
  tail -n 80 "$f"
  echo
done
