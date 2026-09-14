#!/usr/bin/env bash
# Copies verify-email-fix.js to the production server and runs it there
# against the live app (http://127.0.0.1:3002).
set -euo pipefail

SERVER=root@168.144.36.41
REMOTE_DIR=/root/Nuanu-ATS-Frontend-New

scp -o StrictHostKeyChecking=accept-new \
  scripts/verify-email-fix.js \
  "$SERVER:$REMOTE_DIR/scripts/verify-email-fix.js"

echo "=== Running email-fix verification on server ==="
ssh -o StrictHostKeyChecking=accept-new "$SERVER" \
  "cd $REMOTE_DIR && node scripts/verify-email-fix.js"
