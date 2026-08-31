#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p15 "Disaster Recovery Drill"
require_cmd psql "PostgreSQL client"
require_env SCRATCH_DATABASE_URL "DISPOSABLE restore target - never a live database"
[ "${AUDIT_CONFIRM_DISPOSABLE_DB:-0}" = "1" ] || not_verified "set AUDIT_CONFIRM_DISPOSABLE_DB=1 to confirm SCRATCH_DATABASE_URL is disposable; this drill is destructive by design"
cd "$AUDIT_ROOT"
log="$ARTIFACT_DIR/p15-restore.log"
bash scripts/verify-restore.sh > "$log" 2>&1; code=$?
artifact "artifacts/p15-restore.log"
metric restoreExit "$code"
[ "$code" -eq 0 ] && emit PASS || { blocker "restore drill failed - see artifacts/p15-restore.log"; emit FAIL; }
