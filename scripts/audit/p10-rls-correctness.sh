#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p10 "RLS Correctness"
require_env SUPABASE_SERVICE_ROLE_KEY "staging service-role key ONLY - never the production key"
require_env VITE_SUPABASE_URL "staging Supabase URL"
[ "${AUDIT_CONFIRM_STAGING_KEY:-0}" = "1" ] || not_verified "set AUDIT_CONFIRM_STAGING_KEY=1 to confirm this service-role key is staging-scoped"
cd "$AUDIT_ROOT"
bunx vitest run tests/rls-regression.test.ts --reporter=json --outputFile "$ARTIFACT_DIR/p10-rls.json" >/dev/null 2>&1
code=$?
artifact "artifacts/p10-rls.json"
metric vitestExit "$code"
[ "$code" -eq 0 ] && emit PASS || { blocker "RLS regression tests failed"; emit FAIL; }
