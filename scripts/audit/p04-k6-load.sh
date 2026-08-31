#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p04 "k6 Load Test"
require_cmd k6 "load generator"
require_env BASE_URL "staging deployment authorised for load testing"
k6 run --quiet --summary-export "$ARTIFACT_DIR/p04-k6-summary.json" \
  -e BASE_URL="$BASE_URL" "$AUDIT_ROOT/scripts/audit/k6/load.js"
code=$?
artifact "artifacts/p04-k6-summary.json"
p95=$(jqc -r '.metrics.http_req_duration.["p(95)"] // 0' < "$ARTIFACT_DIR/p04-k6-summary.json" 2>/dev/null || echo 0)
metric p95Ms "${p95:-0}"
[ "$code" -eq 0 ] && emit PASS || { blocker "k6 thresholds failed"; emit FAIL; }
