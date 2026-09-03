#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p03 "Licence Lifecycle"
require_env BASE_URL "staging deployment"
require_env TEST_LICENCE_KEY "staging licence key (never a customer key)"
require_env TEST_BUILD_ID "registered staging build id"
require_env TEST_ASSET_DIGEST "registered staging asset digest"
require_cmd curl "HTTP client"
fp="audit-$(date +%s)"
act=$(curl -s --max-time 20 -X POST "${BASE_URL%/}/api/public/licence/activate" \
  -H 'content-type: application/json' \
  -d "{\"licenceKey\":\"$TEST_LICENCE_KEY\",\"platform\":\"desktop\",\"buildId\":\"$TEST_BUILD_ID\",\"assetDigest\":\"$TEST_ASSET_DIGEST\",\"deviceFingerprint\":\"$fp\"}" || echo '{}')
echo "$act" > "$ARTIFACT_DIR/p03-activate.json"; artifact "artifacts/p03-activate.json"
token=$(echo "$act" | jqc -r '.token // ""' 2>/dev/null || echo "")
[ -n "$token" ] || { blocker "activation returned no token"; emit FAIL; }
st=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE_URL%/}/api/public/licence/status?key=$(printf '%s' "$TEST_LICENCE_KEY" | jqc -sRr @uri)")
metric_str activationToken "issued"
metric statusHttp "$st"
[ "$st" = "200" ] && emit PASS || { blocker "status endpoint returned $st"; emit FAIL; }
