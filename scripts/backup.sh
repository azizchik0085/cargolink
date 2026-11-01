#!/usr/bin/env bash
# ==============================================================
# CARGOLINK Automated PostgreSQL Database Backup Script
# Creates compressed, timestamped database dumps.
# Retention policy: Keeps backups for 14 days.
# ==============================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/cargolink_db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL automated backup for ${POSTGRES_DB}..."

pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Prune old backups older than 14 days
echo "[$(date)] Pruning backups older than 14 days..."
find "${BACKUP_DIR}" -type f -name "cargolink_db_*.sql.gz" -mtime +14 -delete

echo "[$(date)] Backup routine finished."
