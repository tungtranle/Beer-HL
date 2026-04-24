#!/usr/bin/env bash
# Safe helper to backup users table and apply canonical migration on staging
# Usage (example):
# PGHOST=localhost PGPORT=5434 PGUSER=bhl PGPASSWORD=... PGDATABASE=bhl_staging ./bhl-oms/scripts/execute_migration.sh
set -euo pipefail

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="users_backup_${TIMESTAMP}.sql"

echo "Backing up current users table to $BACKUP_FILE"
pg_dump --host=${PGHOST:-localhost} --port=${PGPORT:-5434} --username=${PGUSER:-bhl} --dbname=${PGDATABASE:-bhl_prod} -t users > "$BACKUP_FILE"

echo "Review the backup file before proceeding. To apply migration, run the SQL file interactively on staging after review:"
echo "  psql \"host=${PGHOST:-localhost} port=${PGPORT:-5434} user=${PGUSER:-bhl} dbname=${PGDATABASE:-bhl_prod}\" -f bhl-oms/scripts/rebuild_user_catalog.sql"

echo "Note: The rebuild script contains dry-run sections and commented INSERT/COMMIT steps. Uncomment only after manual verification on staging."
