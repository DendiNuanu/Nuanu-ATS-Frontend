#!/bin/bash
###############################################################################
# deploy-new.sh
# Deploys the Nuanu-ATS-Frontend Next.js app to a SEPARATE folder/process on the
# production server, WITHOUT touching the existing production app.
#
# Safety constraints enforced:
#   - Old app (~/Nuanu_HR_Recruitment_ATS, PM2 + Nginx @ hr-ats.nuanu.site) is
#     NEVER stopped, modified, or deleted.
#   - New app goes into ~/Nuanu-ATS-Frontend-New
#   - New PM2 process name: "nuanu-ats-new" on port 3002
#   - New Nginx server block on a NEW subdomain (DOMAIN below)
#   - Nginx is RELOADED (never restarted) so old site keeps serving.
###############################################################################
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit DOMAIN if needed before running.
# ---------------------------------------------------------------------------
SERVER="root@168.144.36.41"
SERVER_IP="168.144.36.41"
# Use absolute paths — ~ does not expand inside heredocs/quoted strings
REMOTE_DIR="/root/Nuanu-ATS-Frontend-New"
OLD_APP_DIR="/root/Nuanu_HR_Recruitment_ATS"
PM2_NAME="nuanu-ats-new"
PORT=3002
# The new subdomain. DNS A record must point to SERVER_IP before Nginx/SSL step.
DOMAIN="hr.ats.new.nuanu.site"

# Pretty colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; }
step() { echo -e "\n${CYAN}=== $* ===${NC}"; }

###############################################################################
# STEP 1 — Push current local code to GitHub
###############################################################################
step "Step 1: Push current local code to GitHub"

# Show the remote URL for confirmation
REMOTE_URL=$(git remote get-url origin)
log "Git remote URL: ${REMOTE_URL}"

if [ -z "${REMOTE_URL}" ]; then
  err "No 'origin' remote configured. Aborting."
  exit 1
fi

# Stage, commit (if needed), and push
git add -A
if git diff --cached --quiet; then
  log "No new changes to commit; working tree clean."
else
  log "Committing staged changes..."
  git commit -m "Deploy: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
fi

log "Pushing to origin main..."
git push origin main

log "Local code pushed to GitHub successfully."

###############################################################################
# STEP 2 — SSH: clone (first time) or pull (redeploy) into ~/Nuanu-ATS-Frontend-New
###############################################################################
step "Step 2: Clone/pull repo on server into ${REMOTE_DIR}"

ssh "${SERVER}" bash -s <<REMOTE_STEP2
set -euo pipefail

if [ ! -d "${REMOTE_DIR}/.git" ]; then
  echo "[remote] First-time clone into ${REMOTE_DIR}..."
  mkdir -p "${REMOTE_DIR}"
  # If the dir exists but isn't a git repo, clone into a temp then move
  if [ "\$(ls -A ${REMOTE_DIR} 2>/dev/null)" ]; then
    echo "[remote] ${REMOTE_DIR} is not empty and not a git repo. Cloning to temp..."
    git clone https://github.com/DendiNuanu/Nuanu-ATS-Frontend.git /tmp/nuanu-ats-frontend-new-clone
    shopt -s dotglob
    cp -r /tmp/nuanu-ats-frontend-new-clone/* "${REMOTE_DIR}/"
    cp -r /tmp/nuanu-ats-frontend-new-clone/.git "${REMOTE_DIR}/"
    rm -rf /tmp/nuanu-ats-frontend-new-clone
  else
    git clone https://github.com/DendiNuanu/Nuanu-ATS-Frontend.git "${REMOTE_DIR}"
  fi
  echo "[remote] Clone complete."
else
  echo "[remote] Repo exists; pulling latest..."
  cd "${REMOTE_DIR}"
  git fetch origin
  git reset --hard origin/main
  echo "[remote] Pull complete."
fi
REMOTE_STEP2

log "Server repo is up to date."

###############################################################################
# STEP 3 — Create .env.local on server (only if it doesn't exist)
#           Copies DATABASE_URL from the real production .env
###############################################################################
step "Step 3: Ensure .env.local exists (copy DATABASE_URL from production)"

ssh "${SERVER}" bash -s <<REMOTE_STEP3
set -euo pipefail

cd "${REMOTE_DIR}"

if [ -f ".env.local" ]; then
  echo "[remote] .env.local already exists — leaving it untouched."
else
  echo "[remote] .env.local not found. Creating from production .env..."
  if [ ! -f "${OLD_APP_DIR}/.env" ]; then
    echo "[remote] ERROR: Production .env not found at ${OLD_APP_DIR}/.env" >&2
    exit 1
  fi
  # Extract DATABASE_URL (and any other needed vars) from the old app's .env
  grep -E '^(DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL)=' "${OLD_APP_DIR}/.env" > .env.local || true
  # Ensure at least DATABASE_URL is present
  if ! grep -q '^DATABASE_URL=' .env.local; then
    echo "[remote] ERROR: DATABASE_URL not found in ${OLD_APP_DIR}/.env" >&2
    exit 1
  fi
  echo "[remote] .env.local created with DATABASE_URL from production."
fi

echo "[remote] .env.local contents (keys only):"
sed -E 's/=(.+)/=<redacted>/' .env.local
REMOTE_STEP3

log ".env.local is ready on the server."

###############################################################################
# STEP 4 — npm install && npm run build (stop immediately if build fails)
###############################################################################
step "Step 4: Install dependencies and build (abort if build fails)"

ssh "${SERVER}" bash -s <<REMOTE_STEP4
set -euo pipefail
cd "${REMOTE_DIR}"

echo "[remote] Installing dependencies (npm ci or npm install)..."
if [ -f "package-lock.json" ]; then
  npm ci
else
  npm install
fi

echo "[remote] Building Next.js production bundle..."
npm run build

echo "[remote] Build succeeded."
REMOTE_STEP4

log "Build completed successfully on the server."

###############################################################################
# STEP 5 — Start/restart PM2 process "nuanu-ats-new" on port 3002
###############################################################################
step "Step 5: Start/restart PM2 process '${PM2_NAME}' on port ${PORT}"

ssh "${SERVER}" bash -s <<REMOTE_STEP5
set -euo pipefail
cd "${REMOTE_DIR}"

# Delete existing process if present so we always start fresh with correct env
if pm2 describe "${PM2_NAME}" > /dev/null 2>&1; then
  echo "[remote] PM2 process '${PM2_NAME}' exists — deleting to restart cleanly..."
  pm2 delete "${PM2_NAME}"
fi

echo "[remote] Starting PM2 process '${PM2_NAME}' on port ${PORT}..."
PORT=${PORT} pm2 start npm --name "${PM2_NAME}" -- start
pm2 save

echo "[remote] PM2 process list:"
pm2 list
REMOTE_STEP5

log "PM2 process '${PM2_NAME}' is running on port ${PORT}."

###############################################################################
# STEP 6 — Open firewall for port 3002
###############################################################################
step "Step 6: Open firewall (ufw allow ${PORT}/tcp)"

ssh "${SERVER}" bash -s <<REMOTE_STEP6
set -euo pipefail
if command -v ufw > /dev/null 2>&1; then
  ufw allow ${PORT}/tcp
  echo "[remote] ufw status (relevant):"
  ufw status | grep -E "${PORT}|Status" || true
else
  echo "[remote] ufw not installed — skipping firewall step."
fi
REMOTE_STEP6

log "Firewall configured for port ${PORT}."

###############################################################################
# STEP 7 — Verify DNS propagation BEFORE touching Nginx
###############################################################################
step "Step 7: Verify DNS for ${DOMAIN} resolves to ${SERVER_IP}"

DNS_IP=$(ssh "${SERVER}" "dig +short ${DOMAIN} A | head -n1" || true)

if [ -z "${DNS_IP}" ]; then
  err "DNS for ${DOMAIN} returned NO A record yet."
  err "The DNS A record was just created in Squarespace and may take up to a few hours to propagate."
  err ""
  err "The app is LIVE and accessible immediately at: http://${SERVER_IP}:${PORT}"
  err "Once DNS propagates, re-run this script to complete the Nginx + SSL setup."
  err "You can check propagation with: dig +short ${DOMAIN}"
  exit 0
fi

log "DNS resolved ${DOMAIN} -> ${DNS_IP}"

if [ "${DNS_IP}" != "${SERVER_IP}" ]; then
  err "DNS for ${DOMAIN} resolves to ${DNS_IP}, NOT ${SERVER_IP}."
  err "DNS has not propagated correctly yet. Wait and re-run this script."
  err ""
  err "The app is LIVE and accessible immediately at: http://${SERVER_IP}:${PORT}"
  exit 0
fi

log "DNS confirmed: ${DOMAIN} -> ${SERVER_IP} ✓"

###############################################################################
# STEP 8 — Set up Nginx reverse proxy + SSL for the new subdomain
###############################################################################
step "Step 8: Configure Nginx reverse proxy + SSL for ${DOMAIN}"

ssh "${SERVER}" bash -s <<REMOTE_STEP8
set -euo pipefail

NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

echo "[remote] --- Reference: existing hr-ats.nuanu.site Nginx config ---"
if [ -f "/etc/nginx/sites-available/hr-ats.nuanu.site" ]; then
  cat /etc/nginx/sites-available/hr-ats.nuanu.site
else
  echo "[remote] (hr-ats.nuanu.site config not found — using sensible defaults)"
fi
echo "[remote] --- End reference ---"
echo ""

# Create the new server block (HTTP first — certbot will add the HTTPS block)
echo "[remote] Creating Nginx config for ${DOMAIN}..."
cat > "\${NGINX_SITE_AVAILABLE}" <<NGINX_CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Reverse proxy to the Next.js app on port ${PORT}
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Next.js static assets caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_cache_bypass \$http_upgrade;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
NGINX_CONF

echo "[remote] Enabling site (symlink to sites-enabled)..."
ln -sf "\${NGINX_SITE_AVAILABLE}" "\${NGINX_SITE_ENABLED}"

echo "[remote] Testing Nginx configuration..."
nginx -t

echo "[remote] Reloading Nginx (reload, NOT restart — old site keeps serving)..."
systemctl reload nginx
echo "[remote] Nginx reloaded."

echo "[remote] Running certbot for SSL on ${DOMAIN}..."
if command -v certbot > /dev/null 2>&1; then
  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --redirect
  echo "[remote] SSL certificate installed."
else
  echo "[remote] WARNING: certbot not installed. SSL not configured."
  echo "[remote] Install with: apt install certbot python3-certbot-nginx"
fi
REMOTE_STEP8

log "Nginx + SSL configured for ${DOMAIN}."

###############################################################################
# STEP 9 — Final summary
###############################################################################
step "Deployment Complete"

echo ""
echo "============================================================"
echo "  🚀 DEPLOYMENT SUMMARY"
echo "============================================================"
echo "  PM2 process name : ${PM2_NAME}"
echo "  Port              : ${PORT}"
echo "  Server folder     : ${REMOTE_DIR}"
echo "  Old app (untouched): ${OLD_APP_DIR} (hr-ats.nuanu.site)"
echo "------------------------------------------------------------"
echo "  Immediate access  : http://${SERVER_IP}:${PORT}"
echo "  Final URL (SSL)  : https://${DOMAIN}"
echo "============================================================"
echo ""
echo "Verify the new site is live:"
echo "  curl -I https://${DOMAIN}"
echo "  pm2 describe ${PM2_NAME}   (on server)"
echo ""
log "Done. The existing production app was NOT touched."
