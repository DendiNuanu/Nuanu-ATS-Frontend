#!/usr/bin/env bash
set -Eeuo pipefail

case "${1:-}" in
  status)
    [[ "$#" -eq 1 ]] || { echo "invalid arguments" >&2; exit 64; }
    /usr/bin/tail -n 500 /root/Nuanu-ATS-Frontend-New/backup-logs/events.log
    ;;
  backup)
    [[ "$#" -eq 1 ]] || { echo "invalid arguments" >&2; exit 64; }
    result=0
    /usr/bin/env bash /root/Nuanu-ATS-Frontend-New/scripts/backup-database-to-drive.sh || result=1
    /usr/bin/env bash /root/Nuanu-ATS-Frontend-New/scripts/backup-resumes-to-drive.sh || result=1
    exit "$result"
    ;;
  verify)
    [[ "$#" -eq 1 ]] || { echo "invalid arguments" >&2; exit 64; }
    /usr/bin/rclone size gdrive:databases/daily --json
    printf '\n--RESUMES--\n'
    /usr/bin/rclone size gdrive:resumes --json
    printf '\n--DATABASE-LISTING--\n'
    /usr/bin/rclone lsl gdrive:databases/daily
    printf '\n--RESUME-LISTING--\n'
    /usr/bin/rclone lsl gdrive:resumes
    ;;
  cron)
    [[ "$#" -eq 1 ]] || { echo "invalid arguments" >&2; exit 64; }
    /usr/bin/crontab -l
    ;;
  *)
    echo "usage: $0 {status|backup|verify|cron}" >&2
    exit 64
    ;;
esac
