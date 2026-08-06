#!/usr/bin/env bash
# Backup script shared by BOTH admin branches. Same script, different
# DATABASE_URL. Neon PITR is paid-tier only — do not rely on it.
#
#   0 3 * * *  /app/scripts/backup-to-r2.sh
set -euo pipefail

: "${DATABASE_URL:?}" "${R2_ACCOUNT_ID:?}" "${R2_BUCKET:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET:?}"

STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="/tmp/aether-${STAMP}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$FILE"

# Upload with aws-cli against the R2 S3 endpoint (R2 is S3-compatible).
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET" \
aws s3 cp "$FILE" "s3://${R2_BUCKET}/backups/aether-${STAMP}.sql.gz" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

rm -f "$FILE"
echo "backup uploaded: backups/aether-${STAMP}.sql.gz"
