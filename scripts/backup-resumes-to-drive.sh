#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/root/Nuanu-ATS-Frontend-New"
LOG_DIR="$APP_DIR/backup-logs"
MANIFEST_DIR="$APP_DIR/backup-manifests"
REMOTE="gdrive:resumes"
LOCK_FILE="/var/lock/nuanu-ats-resume-backup.lock"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/resume-backup-$STAMP.log"
CANONICAL_SOURCE="/var/www/nuanu-uploads/resumes"
LOCAL_SOURCE="$APP_DIR/backups-resumes"
CANONICAL_MANIFEST="$MANIFEST_DIR/canonical-$STAMP.sha256"
LOCAL_MANIFEST="$MANIFEST_DIR/app-local-$STAMP.sha256"
SUMMARY_MANIFEST="$MANIFEST_DIR/summary-$STAMP.txt"

mkdir -p "$LOG_DIR" "$MANIFEST_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "A resume backup is already running" >&2
  exit 75
fi
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date -u +%FT%TZ)] resume backup started"
for source in "$CANONICAL_SOURCE" "$LOCAL_SOURCE"; do
  if [[ ! -d "$source" || ! -r "$source" ]]; then
    echo "Missing readable resume source: $source" >&2
    exit 1
  fi
done

build_manifest() {
  local source="$1"
  local output="$2"
  (
    cd "$source"
    find . -type f -print0 | sort -z | xargs -0 -r sha256sum
  ) > "$output"
}

build_manifest "$CANONICAL_SOURCE" "$CANONICAL_MANIFEST"
build_manifest "$LOCAL_SOURCE" "$LOCAL_MANIFEST"

CANONICAL_FILES="$(find "$CANONICAL_SOURCE" -type f -printf . | wc -c)"
CANONICAL_BYTES="$(find "$CANONICAL_SOURCE" -type f -printf '%s\n' | awk '{sum += $1} END {printf "%.0f", sum + 0}')"
LOCAL_FILES="$(find "$LOCAL_SOURCE" -type f -printf . | wc -c)"
LOCAL_BYTES="$(find "$LOCAL_SOURCE" -type f -printf '%s\n' | awk '{sum += $1} END {printf "%.0f", sum + 0}')"
cat > "$SUMMARY_MANIFEST" <<EOF
created_at_utc=$STAMP
canonical_source=$CANONICAL_SOURCE
canonical_files=$CANONICAL_FILES
canonical_bytes=$CANONICAL_BYTES
app_local_source=$LOCAL_SOURCE
app_local_files=$LOCAL_FILES
app_local_bytes=$LOCAL_BYTES
total_files=$((CANONICAL_FILES + LOCAL_FILES))
total_bytes=$((CANONICAL_BYTES + LOCAL_BYTES))
EOF

RCLONE_FLAGS=(--checksum --create-empty-src-dirs --retries 3 --low-level-retries 10 --stats 30s --stats-one-line --log-level INFO)
rclone copy "$CANONICAL_SOURCE" "$REMOTE/canonical" "${RCLONE_FLAGS[@]}"
rclone copy "$LOCAL_SOURCE" "$REMOTE/app-local" "${RCLONE_FLAGS[@]}"

# One-way checks report missing or changed destination files without deleting anything.
rclone check "$CANONICAL_SOURCE" "$REMOTE/canonical" --one-way --checksum --download --combined "$MANIFEST_DIR/canonical-check-$STAMP.txt"
rclone check "$LOCAL_SOURCE" "$REMOTE/app-local" --one-way --checksum --download --combined "$MANIFEST_DIR/app-local-check-$STAMP.txt"

rclone copyto "$CANONICAL_MANIFEST" "$REMOTE/manifests/$(basename "$CANONICAL_MANIFEST")" --retries 3
rclone copyto "$LOCAL_MANIFEST" "$REMOTE/manifests/$(basename "$LOCAL_MANIFEST")" --retries 3
rclone copyto "$SUMMARY_MANIFEST" "$REMOTE/manifests/$(basename "$SUMMARY_MANIFEST")" --retries 3
rclone copyto "$MANIFEST_DIR/canonical-check-$STAMP.txt" "$REMOTE/manifests/canonical-check-$STAMP.txt" --retries 3
rclone copyto "$MANIFEST_DIR/app-local-check-$STAMP.txt" "$REMOTE/manifests/app-local-check-$STAMP.txt" --retries 3

REMOTE_CANONICAL_FILES="$(rclone size "$REMOTE/canonical" --json | sed -n 's/.*"count":\([0-9]*\).*/\1/p')"
REMOTE_LOCAL_FILES="$(rclone size "$REMOTE/app-local" --json | sed -n 's/.*"count":\([0-9]*\).*/\1/p')"
if [[ "$REMOTE_CANONICAL_FILES" -lt "$CANONICAL_FILES" || "$REMOTE_LOCAL_FILES" -lt "$LOCAL_FILES" ]]; then
  echo "Remote count verification failed: canonical=$REMOTE_CANONICAL_FILES/$CANONICAL_FILES app-local=$REMOTE_LOCAL_FILES/$LOCAL_FILES" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] resume backup completed canonical_files=$CANONICAL_FILES canonical_bytes=$CANONICAL_BYTES app_local_files=$LOCAL_FILES app_local_bytes=$LOCAL_BYTES failures=0"
