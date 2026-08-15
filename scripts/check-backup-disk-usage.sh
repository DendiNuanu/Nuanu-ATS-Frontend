#!/usr/bin/env bash
set -Eeuo pipefail

THRESHOLD="${DISK_USAGE_THRESHOLD:-80}"
LOG_DIR="/root/Nuanu-ATS-Frontend-New/backup-logs"
LOG_FILE="$LOG_DIR/disk-usage.log"
USAGE="$(df -P / | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"

mkdir -p "$LOG_DIR"
if [[ ! "$USAGE" =~ ^[0-9]+$ ]]; then
  echo "[$(date -u +%FT%TZ)] unable to determine root filesystem usage" | tee -a "$LOG_FILE" >&2
  exit 1
fi

if (( USAGE > THRESHOLD )); then
  MESSAGE="Nuanu ATS backup warning: root filesystem usage is ${USAGE}% (threshold ${THRESHOLD}%)"
  echo "[$(date -u +%FT%TZ)] $MESSAGE" | tee -a "$LOG_FILE" >&2
  logger -p user.warning -t nuanu-ats-backup "$MESSAGE"
fi
