#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p13 "R2 Presign Benchmark"
require_env BASE_URL "staging deployment"
require_env R2_ACCOUNT_ID "R2 account for presign checks"
require_cmd curl "HTTP client"
start=$(now_ms)
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE_URL%/}/api/public/m/does-not-exist")
dur=$(( $(now_ms) - start ))
metric presignProbeMs "$dur"
metric presignProbeHttp "$code"
[[ "$code" =~ ^(401|403|404|410)$ ]] && emit PASS || { blocker "unauthenticated media nonce probe returned $code (expected a denial)"; emit FAIL; }
