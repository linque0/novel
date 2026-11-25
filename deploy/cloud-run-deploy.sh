#!/usr/bin/env bash
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

# 小说工坊 Web Demo 一键部署至 Google Cloud Run（asia-east1）
# 可通过环境变量覆盖默认配置：
#   PROJECT_ID=... REGION=asia-east1 SERVICE=novel-studio-demo MIN_INSTANCES=0 ./deploy/cloud-run-deploy.sh

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-asia-east1}"
REPO="${REPO:-novel-studio}"
SERVICE="${SERVICE:-novel-studio-demo}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
VITE_WEB_DEMO="${VITE_WEB_DEMO:-true}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: PROJECT_ID is empty. Run: PROJECT_ID=<your-gcp-project-id> $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${IMAGE_TAG}"

echo "==> Project: ${PROJECT_ID} | Region: ${REGION} | Service: ${SERVICE} | Min instances: ${MIN_INSTANCES}"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com --project="${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Novel Studio Web Demo container images" \
    --project="${PROJECT_ID}" || true
  gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

docker build \
  --build-arg "VITE_WEB_DEMO=${VITE_WEB_DEMO}" \
  -t "${IMAGE_URI}" \
  "${APP_DIR}"

docker push "${IMAGE_URI}"

gcloud run deploy "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --image="${IMAGE_URI}" \
  --port=8080 \
  --allow-unauthenticated \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances=3 \
  --memory=512Mi \
  --cpu=1

SERVICE_URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
echo "==> Deployed successfully: ${SERVICE_URL}"
echo "==> Before live demo (eliminate cold start):"
echo "    gcloud run services update ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --min-instances=1"
echo "==> After live demo (back to \$0 idle):"
echo "    gcloud run services update ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --min-instances=0"
