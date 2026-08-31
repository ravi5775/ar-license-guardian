#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p06 "Stress Test"
require_env BASE_URL "staging deployment authorised for load testing"
require_cmd npx "node package runner for autocannon"
if [ "${AUDIT_ALLOW_HEAVY_LOAD:-0}" != "1" ] && [ "p06" != "p05" ]; then
  not_verified "heavy load stage skipped: set AUDIT_ALLOW_HEAVY_LOAD=1 to authorise sustained traffic against $BASE_URL"
fi
out="$ARTIFACT_DIR/p06-autocannon.json"
npx --yes autocannon -c 200 -d 60 -j "$BASE_URL" > "$out" 2>"$ARTIFACT_DIR/p06-autocannon.log" || not_verified "autocannon could not run"
artifact "artifacts/p06-autocannon.json"
rps=$(jqc -r '.requests.average // 0' < "$out")
p99=$(jqc -r '.latency.p99 // 0' < "$out")
errs=$(jqc -r '.errors // 0' < "$out")
non2xx=$(jqc -r '.non2xx // 0' < "$out")
metric requestsPerSecond "${rps:-0}"
metric latencyP99Ms "${p99:-0}"
metric errors "${errs:-0}"
metric non2xx "${non2xx:-0}"
[ "${errs:-0}" = "0" ] && emit PASS || { blocker "$errs transport errors under load"; emit FAIL; }
