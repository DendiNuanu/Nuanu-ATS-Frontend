#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Backup output configuration
# The timestamp below is taken from the LOCAL machine's system clock (i.e. the
# machine this script runs on), using its configured timezone. Format is
# 24-hour: YYYY-MM-DD_HH-MM. To change the timezone used in the filename,
# change the OS timezone of this local machine, e.g.:
#   sudo timedatectl set-timezone Asia/Makassar
# ---------------------------------------------------------------------------
BACKUP_DIR=~/Nuanu-ATS-Frontend/db-backups
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
DUMP_FILE="$BACKUP_DIR/nuanu-ats-$TIMESTAMP.dump"

echo "=== Step 1: Cek DATABASE_URL di server (read-only) ==="
ssh root@168.144.36.41 "cat ~/Nuanu_HR_Recruitment_ATS/.env | grep DATABASE_URL"

echo ""
echo "=== Lihat baris DATABASE_URL di atas, catat: USER, PASSWORD, HOST, PORT, DBNAME ==="
echo "Lalu edit variabel di bawah ini sebelum lanjut, atau isi manual saat diminta."
echo ""

read -p "Masukkan DB_USER: " DB_USER
read -sp "Masukkan DB_PASSWORD: " DB_PASSWORD
echo ""
read -p "Masukkan DB_HOST (biasanya 'localhost'): " DB_HOST
read -p "Masukkan DB_PORT (biasanya '5432'): " DB_PORT
read -p "Masukkan DB_NAME: " DB_NAME

echo ""
echo "=== Step 2: Membuat dump baru dari database live di server (read-only) ==="
ssh root@168.144.36.41 "PGPASSWORD='$DB_PASSWORD' pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT -Fc $DB_NAME > ~/nuanu_live_dump.dump && ls -lh ~/nuanu_live_dump.dump"

echo ""
echo "=== Step 3: Download dump + schema Prisma ke lokal ==="
mkdir -p "$BACKUP_DIR"
echo "Menyimpan dump ke: $DUMP_FILE"
scp root@168.144.36.41:~/nuanu_live_dump.dump "$DUMP_FILE"
scp root@168.144.36.41:~/Nuanu_HR_Recruitment_ATS/prisma/schema.prisma ~/Nuanu-ATS-Frontend/prisma-reference-schema.prisma

echo ""
echo "=== Step 4: Setup Postgres lokal via Docker ==="
docker rm -f nuanu-local-db 2>/dev/null || true
docker run --name nuanu-local-db \
  -e POSTGRES_USER=nuanu \
  -e POSTGRES_PASSWORD=localpass123 \
  -e POSTGRES_DB=nuanu_ats_local \
  -p 5433:5432 \
  -d postgres:15

echo "Menunggu Postgres siap..."
sleep 6

echo ""
echo "=== Step 5: Restore dump ke database lokal ==="
cd ~/Nuanu-ATS-Frontend
docker exec -i nuanu-local-db pg_restore --no-owner --no-privileges \
  -U nuanu -d nuanu_ats_local < "$DUMP_FILE"

echo ""
echo "=== SELESAI ==="
echo "Database lokal siap di: postgresql://nuanu:localpass123@localhost:5433/nuanu_ats_local"
echo "Schema referensi ada di: ~/Nuanu-ATS-Frontend/prisma-reference-schema.prisma"
echo ""
echo "=== Backup dump tersimpan ==="
echo "Timestamp clock: local machine system time ($(date +%Z))"
echo "File  : $DUMP_FILE"
echo "Ukuran: $(ls -lh "$DUMP_FILE" | awk '{print $5}')"

# ---------------------------------------------------------------------------
# Step 6 (OPTIONAL, PROMPTED): Download resume/CV files from the remote server
# (READ-ONLY). Source path = UPLOAD_DIR from the remote .env
# (/var/www/nuanu-uploads/resumes).
#
# This step is OPTIONAL and asks the user each run:
#   "Apakah ingin membackup resume/CV juga? [y/N]:"
#   - y / Y  -> proceed with the resume backup
#   - n / N / Enter (empty) -> skip cleanly and finish normally
# It reuses the SAME $TIMESTAMP used for the DB dump, so the two backups from
# one run are paired.
#
# Read-only on the remote: rsync is invoked WITHOUT --delete and without any
# write-back; we only pull files. tar+ssh fallback also only reads.
#
# NON-FATAL: a failure here must NOT invalidate the DB dump/restore that already
# completed above. We disable `set -e` for this block and always print a clear
# status. The DB backup remains valid regardless of the resume step's outcome.
# ---------------------------------------------------------------------------
echo ""
read -p "Apakah ingin membackup resume/CV juga? [y/N]: " RESUME_ANSWER
RESUME_ANSWER=$(echo "$RESUME_ANSWER" | tr -d '[:space:]')

if [ "$RESUME_ANSWER" = "y" ] || [ "$RESUME_ANSWER" = "Y" ]; then
  echo ""
  echo "=== Step 6: Download resume/CV files dari server (read-only) ==="
  RESUME_REMOTE="root@168.144.36.41:/var/www/nuanu-uploads/resumes/"
  RESUME_DIR=~/Nuanu-ATS-Frontend/backups-resumes
  RESUME_DEST="$RESUME_DIR/resumes-$TIMESTAMP"
  mkdir -p "$RESUME_DIR"

  set +e
  RESUME_OK=0

  if command -v rsync >/dev/null 2>&1; then
    echo "Metode: rsync -az --info=progress2 (incremental via --link-dest bila ada snapshot sebelumnya)"
    # Find the most recent previous snapshot to hardlink unchanged files from.
    # This makes repeat runs fast (only changed/new files are transferred & stored).
    PREV=$(find "$RESUME_DIR" -maxdepth 1 -type d -name 'resumes-*' 2>/dev/null | sort | tail -1)
    LINK_DEST_ARG=""
    if [ -n "$PREV" ]; then
      LINK_DEST_ARG="--link-dest=$PREV"
      echo "Snapshot sebelumnya: $PREV (file tidak berubah akan di-hardlink, bukan disalin ulang)"
    else
      echo "Belum ada snapshot sebelumnya -> transfer penuh (sekali saja, run berikutnya akan incremental)"
    fi
    echo "Destinasi: $RESUME_DEST"
    echo "(Folder besar ~2GB; rsync menampilkan bar progres. Jangan dianggap hang.)"
    rsync -az --info=progress2 --stats $LINK_DEST_ARG "$RESUME_REMOTE" "$RESUME_DEST"
    RSYNC_RC=$?
    if [ $RSYNC_RC -eq 0 ]; then
      RESUME_OK=1
    else
      echo "WARNING: rsync gagal (exit $RSYNC_RC). Mencoba fallback tar+ssh..."
    fi
  else
    echo "rsync tidak tersedia secara lokal -> menggunakan fallback tar+ssh..."
  fi

  # Fallback: stream a tar.gz over ssh (matches the existing resumes_*.tar.gz format).
  # Read-only on the server: `tar -czf -` only reads files.
  if [ $RESUME_OK -ne 1 ]; then
    RESUME_TAR="$RESUME_DIR/resumes-$TIMESTAMP.tar.gz"
    echo "Membuat $RESUME_TAR via tar+ssh (streaming, read-only di server)..."
    ssh root@168.144.36.41 "tar -czf - -C /var/www/nuanu-uploads resumes" > "$RESUME_TAR"
    TAR_RC=$?
    if [ $TAR_RC -eq 0 ] && [ -s "$RESUME_TAR" ]; then
      RESUME_OK=1
      RESUME_DEST="$RESUME_TAR"
    else
      echo "ERROR: fallback tar+ssh juga gagal (exit $TAR_RC). Backup database di atas tetap valid & dapat dipakai."
    fi
  fi

  if [ $RESUME_OK -eq 1 ]; then
    if [ -d "$RESUME_DEST" ]; then
      RESUME_COUNT=$(find "$RESUME_DEST" -type f -iname "*.pdf" 2>/dev/null | wc -l)
      RESUME_SIZE=$(du -sh "$RESUME_DEST" 2>/dev/null | awk '{print $1}')
    else
      RESUME_COUNT=$(tar -tzf "$RESUME_DEST" 2>/dev/null | grep -ci '\.pdf$')
      RESUME_SIZE=$(ls -lh "$RESUME_DEST" | awk '{print $5}')
    fi
    echo ""
    echo "=== Resume backup tersimpan ==="
    echo "Timestamp: $TIMESTAMP (local machine system time, $(date +%Z))"
    echo "Lokasi   : $RESUME_DEST"
    echo "Jumlah   : $RESUME_COUNT file PDF"
    echo "Ukuran   : $RESUME_SIZE"
  else
    echo ""
    echo "=== Resume backup GAGAL ==="
    echo "Backup database (dump + restore lokal) tetap BERHASIL dan valid. Lihat pesan error di atas."
  fi
  set -e
else
  echo ""
  echo "=== Step 6: Backup resume/CV dilewati (skip) ==="
  echo "Backup database (dump + restore lokal) tetap BERHASIL dan valid."
fi