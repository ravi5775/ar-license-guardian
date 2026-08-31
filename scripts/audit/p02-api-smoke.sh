#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p02 "API Smoke Matrix"
require_env BASE_URL "staging deployment to smoke-test"
require_cmd curl "HTTP client"
paths=("/" "/api/public/licence/manifest" "/sitemap.xml" "/auth")
ok=0; total=0
for p in "${paths[@]}"; do
  total=$((total+1))
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${BASE_URL%/}$p" || echo 000)
  note "$p -> $code"
  [[ "$code" =~ ^(200|204|301|302|401|403)$ ]] && ok=$((ok+1)) || blocker "$p returned $code"
done
metric endpointsChecked "$total"
metric endpointsOk "$ok"
[ "$ok" -eq "$total" ] && emit PASS || emit FAIL
