#!/bin/bash
# Remote helper: final sanity check — other Claudia Olmos records must still exist
set -e
ssh root@168.144.36.41 "cd /root/Nuanu-ATS-Frontend-New && node scripts/find-user.js c.olmoslpz"
