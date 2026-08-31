#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p09 "Database Capacity"
require_cmd psql "PostgreSQL client"
require_env AUDIT_DATABASE_URL "staging database connection string (never production)"
out="$ARTIFACT_DIR/p09-capacity.txt"
psql "$AUDIT_DATABASE_URL" -A -F, -c "select relname, n_live_tup, pg_total_relation_size(relid) from pg_stat_user_tables order by 3 desc limit 20" > "$out" 2>&1 || not_verified "could not query the staging database"
artifact "artifacts/p09-capacity.txt"
metric tablesProfiled "$(( $(wc -l < "$out") - 2 ))"
emit PASS
