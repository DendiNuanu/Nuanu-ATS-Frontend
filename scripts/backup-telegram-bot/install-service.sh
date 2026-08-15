#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${1:-/root/Nuanu-ATS-Frontend-New}"
SOURCE_DIR="$APP_DIR/scripts/backup-telegram-bot"
RUNTIME_DIR="/opt/nuanu-ats-backup-bot"
SERVICE_USER="nuanu-backup-bot"
SERVICE_GROUP="nuanu-backup-bot"
SERVICE_NAME="nuanu-ats-backup-bot.service"
WRAPPER="/usr/local/sbin/nuanu-ats-backup-operations"
SUDOERS="/etc/sudoers.d/nuanu-ats-backup-bot"
ENV_FILE="$APP_DIR/.env.telegram-bot"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer as root" >&2
  exit 1
fi
for file in bot.js lib.js root-operations.sh nuanu-ats-backup-bot.service; do
  [[ -f "$SOURCE_DIR/$file" ]] || { echo "Missing $SOURCE_DIR/$file" >&2; exit 1; }
done

if ! getent group "$SERVICE_GROUP" >/dev/null; then groupadd --system "$SERVICE_GROUP"; fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --gid "$SERVICE_GROUP" --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -o root -g root -m 755 "$RUNTIME_DIR"
install -o root -g root -m 644 "$SOURCE_DIR/bot.js" "$RUNTIME_DIR/bot.js"
install -o root -g root -m 644 "$SOURCE_DIR/lib.js" "$RUNTIME_DIR/lib.js"
install -o root -g root -m 755 "$SOURCE_DIR/root-operations.sh" "$WRAPPER"
install -o root -g root -m 644 "$SOURCE_DIR/$SERVICE_NAME" "/etc/systemd/system/$SERVICE_NAME"

cat > "$SUDOERS" <<EOF
$SERVICE_USER ALL=(root) NOPASSWD: $WRAPPER status
$SERVICE_USER ALL=(root) NOPASSWD: $WRAPPER cron
$SERVICE_USER ALL=(root) NOPASSWD: $WRAPPER verify
$SERVICE_USER ALL=(root) NOPASSWD: $WRAPPER backup
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

mkdir -p "$APP_DIR/backup-logs" "$APP_DIR/backup-manifests" "$APP_DIR/backups"
chmod 755 "$APP_DIR/scripts/backup-database-to-drive.sh" "$APP_DIR/scripts/backup-resumes-to-drive.sh" "$APP_DIR/scripts/check-backup-disk-usage.sh"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

if [[ -f "$ENV_FILE" ]]; then
  if [[ "$(stat -c %U:%a "$ENV_FILE")" != "root:600" ]]; then
    echo "WARNING: $ENV_FILE exists but must be root-owned mode 600 before service startup." >&2
  fi
else
  echo "Token file intentionally not created. Dendy must create $ENV_FILE directly on the server as root with mode 600."
fi
echo "Installed and enabled $SERVICE_NAME. The installer did not start it."
