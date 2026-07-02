#!/bin/bash
set -e

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
scp root@168.144.36.41:~/nuanu_live_dump.dump ~/Nuanu-ATS-Frontend/nuanu_live_dump.dump
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
  -U nuanu -d nuanu_ats_local < nuanu_live_dump.dump

echo ""
echo "=== SELESAI ==="
echo "Database lokal siap di: postgresql://nuanu:localpass123@localhost:5433/nuanu_ats_local"
echo "Schema referensi ada di: ~/Nuanu-ATS-Frontend/prisma-reference-schema.prisma"