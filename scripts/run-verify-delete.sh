#!/usr/bin/env bash
# Verifies the deleted candidate is gone and the other Claudia Olmos is intact.
set -euo pipefail

SERVER=root@168.144.36.41
REMOTE_DIR=/root/Nuanu-ATS-Frontend-New

echo "=== Verifying deletion on server ==="
ssh -o StrictHostKeyChecking=accept-new "$SERVER" \
  "cd $REMOTE_DIR && node scripts/find-user.js claudia"
