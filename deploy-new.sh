#!/usr/bin/env bash
###############################################################################
# deploy-new.sh
#
# Nuanu HR ATS - PROXMOX PRODUCTION DEPLOYMENT
#
# Production architecture:
#   Proxmox VM : 172.16.252.218
#   Project    : /var/www/Nuanu-ATS-Frontend-New
#   Runtime    : Docker
#   Container  : nuanu-ats-new
#   Image      : nuanu-ats-new:proxmox
#   App Port   : 3000 (host networking)
#   Public URL : https://hr.ats.new.nuanu.site
#
# Reverse proxy / SSL are handled separately by:
#   lb-nginx-ms
#
# This script DOES NOT:
#   - configure Nginx
#   - configure Certbot
#   - modify .env.local
#   - run destructive Prisma db push
#   - automatically git add / commit / push
###############################################################################

set -Eeuo pipefail

PROJECT_DIR="/var/www/Nuanu-ATS-Frontend-New"
CONTAINER_NAME="nuanu-ats-new"
IMAGE_NAME="nuanu-ats-new"
PRODUCTION_TAG="proxmox"
APP_PORT="3000"
PUBLIC_DOMAIN="hr.ats.new.nuanu.site"

TS="$(date +%Y%m%d-%H%M%S)"
RELEASE_TAG="release-${TS}"
ROLLBACK_TAG="rollback-${TS}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; }
step() { echo -e "\n${CYAN}=== $* ===${NC}"; }

rollback_available=0

###############################################################################
# STEP 1 - Preflight
###############################################################################

step "Step 1: Preflight checks"

cd "${PROJECT_DIR}"

if [ ! -d ".git" ]; then
    err "${PROJECT_DIR} is not a Git repository."
    exit 1
fi

if [ ! -f ".env.local" ]; then
    err ".env.local is missing."
    err "Deployment aborted. Production environment will NOT be recreated."
    exit 1
fi

if [ ! -f "Dockerfile" ]; then
    err "Dockerfile is missing."
    exit 1
fi

if [ ! -f "compose.yml" ]; then
    err "compose.yml is missing."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    err "Docker is not installed."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    err "Docker Compose plugin is not available."
    exit 1
fi

chmod 600 .env.local || true

log "Project     : ${PROJECT_DIR}"
log "Container   : ${CONTAINER_NAME}"
log "Image       : ${IMAGE_NAME}:${PRODUCTION_TAG}"
log "Port        : ${APP_PORT}"
log "Public URL  : https://${PUBLIC_DOMAIN}"

###############################################################################
# STEP 2 - Sync production source with GitHub main
###############################################################################

step "Step 2: Sync source with GitHub main"

# Never overwrite tracked production changes automatically.
if ! git diff --quiet || ! git diff --cached --quiet; then
    err "Tracked files have uncommitted changes."
    err "Commit/push them first before deploying."
    echo
    git status --short
    exit 1
fi

log "Fetching origin/main..."
git fetch origin main

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

log "Current HEAD : ${LOCAL_HEAD}"
log "origin/main  : ${REMOTE_HEAD}"

if [ "${LOCAL_HEAD}" != "${REMOTE_HEAD}" ]; then
    log "Updating production working tree to origin/main..."
    git reset --hard origin/main
else
    log "Production source already matches origin/main."
fi

log "Deploying commit:"
git log -1 --oneline

###############################################################################
# STEP 3 - Validate Docker Compose and save rollback image
###############################################################################

step "Step 3: Validate Docker config and prepare rollback"

docker compose config >/dev/null
log "compose.yml validation OK."

CURRENT_IMAGE_ID="$(
    docker inspect \
        --format='{{.Image}}' \
        "${CONTAINER_NAME}" \
        2>/dev/null || true
)"

if [ -n "${CURRENT_IMAGE_ID}" ]; then
    log "Current production image: ${CURRENT_IMAGE_ID}"
    docker tag \
        "${CURRENT_IMAGE_ID}" \
        "${IMAGE_NAME}:${ROLLBACK_TAG}"

    rollback_available=1
    log "Rollback image saved as ${IMAGE_NAME}:${ROLLBACK_TAG}"
else
    warn "No existing ${CONTAINER_NAME} container found."
    warn "This appears to be a first deployment; automatic rollback unavailable."
fi

###############################################################################
# STEP 4 - Build new Docker image
###############################################################################

step "Step 4: Build production Docker image"

export DOCKER_BUILDKIT=1

log "Building ${IMAGE_NAME}:${RELEASE_TAG}..."

docker build \
    --secret id=env,src=.env.local \
    --tag "${IMAGE_NAME}:${RELEASE_TAG}" \
    .

log "Docker build successful."

# compose.yml currently references nuanu-ats-new:proxmox.
docker tag \
    "${IMAGE_NAME}:${RELEASE_TAG}" \
    "${IMAGE_NAME}:${PRODUCTION_TAG}"

log "Production tag updated: ${IMAGE_NAME}:${PRODUCTION_TAG}"

###############################################################################
# STEP 5 - Recreate ATS container
###############################################################################

step "Step 5: Deploy container"

docker compose up -d --force-recreate

log "Waiting for container startup..."
sleep 3

docker ps \
    --filter "name=${CONTAINER_NAME}" \
    --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

###############################################################################
# STEP 6 - Health check
###############################################################################

step "Step 6: Local application health check"

HEALTH_OK=0

for attempt in $(seq 1 30); do
    if curl \
        --fail \
        --silent \
        --show-error \
        --max-time 5 \
        "http://127.0.0.1:${APP_PORT}/" \
        >/dev/null 2>&1
    then
        HEALTH_OK=1
        break
    fi

    echo "[deploy] Waiting for ATS... attempt ${attempt}/30"
    sleep 2
done

if [ "${HEALTH_OK}" -ne 1 ]; then
    err "ATS failed local health check."
    echo
    echo "===== CONTAINER LOG ====="
    docker logs --tail 150 "${CONTAINER_NAME}" 2>&1 || true

    if [ "${rollback_available}" -eq 1 ]; then
        warn "Rolling back automatically to previous image..."

        docker tag \
            "${IMAGE_NAME}:${ROLLBACK_TAG}" \
            "${IMAGE_NAME}:${PRODUCTION_TAG}"

        docker compose up -d --force-recreate

        sleep 3

        if curl \
            --fail \
            --silent \
            --max-time 5 \
            "http://127.0.0.1:${APP_PORT}/" \
            >/dev/null 2>&1
        then
            warn "Rollback completed successfully."
        else
            err "Rollback container also failed health check."
        fi
    fi

    exit 1
fi

log "ATS local health check PASSED."

###############################################################################
# STEP 7 - Final verification
###############################################################################

step "Step 7: Final verification"

RUNNING_IMAGE="$(
    docker inspect \
        --format='{{.Image}}' \
        "${CONTAINER_NAME}"
)"

EXPECTED_IMAGE="$(
    docker image inspect \
        --format='{{.Id}}' \
        "${IMAGE_NAME}:${PRODUCTION_TAG}"
)"

echo
echo "===== CONTAINER ====="
docker ps \
    --filter "name=${CONTAINER_NAME}" \
    --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

echo
echo "===== LISTENER ====="
ss -ltnp 2>/dev/null | grep ":${APP_PORT}" || true

echo
echo "===== APP RESPONSE ====="
curl -sS \
    -o /dev/null \
    -w 'HTTP %{http_code}\n' \
    --max-time 10 \
    "http://127.0.0.1:${APP_PORT}/"

echo
echo "===== IMAGE ====="
echo "Running  : ${RUNNING_IMAGE}"
echo "Expected : ${EXPECTED_IMAGE}"

if [ "${RUNNING_IMAGE}" != "${EXPECTED_IMAGE}" ]; then
    err "Running container image does not match production image."
    exit 1
fi

###############################################################################
# COMPLETE
###############################################################################

step "Deployment Complete"

echo
echo "============================================================"
echo "  NUANU HR ATS - PROXMOX"
echo "============================================================"
echo "  Commit      : $(git rev-parse --short HEAD)"
echo "  VM          : 172.16.252.218"
echo "  Project     : ${PROJECT_DIR}"
echo "  Container   : ${CONTAINER_NAME}"
echo "  Image       : ${IMAGE_NAME}:${PRODUCTION_TAG}"
echo "  Release     : ${IMAGE_NAME}:${RELEASE_TAG}"
echo "  Local       : http://127.0.0.1:${APP_PORT}"
echo "  Public      : https://${PUBLIC_DOMAIN}"
echo "------------------------------------------------------------"
echo "  Reverse proxy: lb-nginx-ms"
echo "  Nginx is NOT modified by this deployment."
echo "============================================================"
echo

log "Deployment completed successfully."
