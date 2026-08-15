#!/usr/bin/env bash
set -Eeuo pipefail

THRESHOLD="${DISK_USAGE_THRESHOLD:-80}"
LOG_DIR="/root/Nuanu-ATS-Frontend-New/backup-logs"
LOG_FILE="$LOG_DIR/disk-usage.log"
EVENT_LOG="$LOG_DIR/events.log"
STATE_FILE="$LOG_DIR/disk-warning.state"
USAGE="$(df -P / | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"

mkdir -p "$LOG_DIR"
if [[ ! "$USAGE" =~ ^[0-9]+$ ]]; then
  echo "[$(date -u +%FT%TZ)] unable to determine root filesystem usage" | tee -a "$LOG_FILE" >&2
  exit 1
fi

if (( USAGE >= THRESHOLD )); then
  MESSAGE="Nuanu ATS backup warning: root filesystem usage is ${USAGE}% (threshold ${THRESHOLD}%)"
  echo "[$(date -u +%FT%TZ)] $MESSAGE" | tee -a "$LOG_FILE" >&2
  logger -p user.warning -t nuanu-ats-backup "$MESSAGE"
  if [[ ! -f "$STATE_FILE" ]]; then
    printf '%s type=disk status=warning usage=%s threshold=%s\n' \
      "$(date -u +%FT%TZ)" "$USAGE" "$THRESHOLD" >> "$EVENT_LOG"
    printf '%s\n' "$USAGE" > "$STATE_FILE"
  fi
elif [[ -f "$STATE_FILE" ]]; then
  rm -f "$STATE_FILE"
  printf '%s type=disk status=recovered usage=%s threshold=%s\n' \
    "$(date -u +%FT%TZ)" "$USAGE" "$THRESHOLD" >> "$EVENT_LOG"
fi
