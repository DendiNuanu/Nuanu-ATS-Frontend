#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/root/Nuanu-ATS-Frontend-New"
BACKUP_DIR="$APP_DIR/backups"
LOG_DIR="$APP_DIR/backup-logs"
REMOTE="gdrive:databases"
LOCK_FILE="/var/lock/nuanu-ats-database-backup.lock"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAILY_NAME="ats-db-daily-$STAMP.dump"
DAILY_PATH="$BACKUP_DIR/$DAILY_NAME"
CHECKSUM_PATH="$DAILY_PATH.sha256"
LOG_FILE="$LOG_DIR/database-backup-$STAMP.log"

mkdir -p "$BACKUP_DIR" "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "A database backup is already running" >&2
  exit 75
fi
exec > >(tee -a "$LOG_FILE") 2>&1

cleanup_partial() {
  if [[ -f "$DAILY_PATH" && ! -f "$CHECKSUM_PATH" ]]; then
    rm -f "$DAILY_PATH"
  fi
}
trap cleanup_partial EXIT

echo "[$(date -u +%FT%TZ)] database backup started"
if [[ ! -r "$APP_DIR/.env.local" ]]; then
  echo "Missing readable $APP_DIR/.env.local" >&2
  exit 1
fi

DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$APP_DIR/.env.local" | tail -n 1)"
DATABASE_URL="${DATABASE_URL%\"}"
DATABASE_URL="${DATABASE_URL#\"}"
DATABASE_URL="${DATABASE_URL%\'}"
DATABASE_URL="${DATABASE_URL#\'}"
DATABASE_URL="${DATABASE_URL%%\?schema=*}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL is empty" >&2
  exit 1
fi

pg_dump --format=custom --no-owner --no-privileges --file="$DAILY_PATH" "$DATABASE_URL"
sha256sum "$DAILY_PATH" > "$CHECKSUM_PATH"
rclone copyto "$DAILY_PATH" "$REMOTE/daily/$DAILY_NAME" --retries 3 --low-level-retries 10
rclone copyto "$CHECKSUM_PATH" "$REMOTE/daily/$DAILY_NAME.sha256" --retries 3 --low-level-retries 10

if [[ "$(date -u +%u)" == "7" ]]; then
  WEEKLY_NAME="ats-db-weekly-$STAMP.dump"
  cp --reflink=auto "$DAILY_PATH" "$BACKUP_DIR/$WEEKLY_NAME"
  cp "$CHECKSUM_PATH" "$BACKUP_DIR/$WEEKLY_NAME.sha256"
  sed -i "s|  $DAILY_PATH$|  $BACKUP_DIR/$WEEKLY_NAME|" "$BACKUP_DIR/$WEEKLY_NAME.sha256"
  rclone copyto "$BACKUP_DIR/$WEEKLY_NAME" "$REMOTE/weekly/$WEEKLY_NAME" --retries 3 --low-level-retries 10
  rclone copyto "$BACKUP_DIR/$WEEKLY_NAME.sha256" "$REMOTE/weekly/$WEEKLY_NAME.sha256" --retries 3 --low-level-retries 10
fi

mapfile -t OLD_DAILY < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ats-db-daily-*.dump' -printf '%T@ %p\n' | sort -nr | tail -n +8 | cut -d' ' -f2-)
for dump in "${OLD_DAILY[@]}"; do
  rm -f -- "$dump" "$dump.sha256"
done
mapfile -t OLD_WEEKLY < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ats-db-weekly-*.dump' -printf '%T@ %p\n' | sort -nr | tail -n +5 | cut -d' ' -f2-)
for dump in "${OLD_WEEKLY[@]}"; do
  rm -f -- "$dump" "$dump.sha256"
done

BYTES="$(stat -c %s "$DAILY_PATH")"
REMOTE_BYTES="$(rclone size "$REMOTE/daily/$DAILY_NAME" --json | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
if [[ "$REMOTE_BYTES" != "$BYTES" ]]; then
  echo "Remote verification failed: local=$BYTES remote=${REMOTE_BYTES:-unknown}" >&2
  exit 1
fi

trap - EXIT
echo "[$(date -u +%FT%TZ)] database backup completed file=$DAILY_NAME bytes=$BYTES sha256=$(cut -d' ' -f1 "$CHECKSUM_PATH")"
