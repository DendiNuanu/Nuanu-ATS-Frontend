#!/usr/bin/env bash
# Copies delete-candidates.js to the production server and runs it there.
# Pass arguments through:  bash scripts/run-remote-delete.sh           (dry run)
#                         bash scripts/run-remote-delete.sh --apply    (delete)
set -euo pipefail

SERVER=root@168.144.36.41
REMOTE_DIR=/root/Nuanu-ATS-Frontend-New

scp -o StrictHostKeyChecking=accept-new \
  scripts/delete-candidates.js \
  "$SERVER:$REMOTE_DIR/scripts/delete-candidates.js"

echo "=== Running deletion script on server ($*) ==="
ssh -o StrictHostKeyChecking=accept-new "$SERVER" \
  "cd $REMOTE_DIR && node scripts/delete-candidates.js $*"
