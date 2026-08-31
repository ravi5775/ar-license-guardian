#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p12 "Device Clone Detection"
require_env BASE_URL "staging deployment"
require_env TEST_LICENCE_KEY "staging licence key"
require_cmd curl "HTTP client"
body() { curl -s --max-time 20 -X POST "${BASE_URL%/}/api/public/license/activate" -H 'content-type: application/json' \
  -d "{\"licenseKey\":\"$TEST_LICENCE_KEY\",\"deploymentFingerprint\":\"$1\",\"domain\":\"audit.local\"}"; }
a=$(body "clone-a-$(date +%s)"); b=$(body "clone-b-$(date +%s)")
echo "$a$b" > "$ARTIFACT_DIR/p12-activations.json"; artifact "artifacts/p12-activations.json"
second_ok=$(echo "$b" | grep -c '"token"' || true)
metric secondSlotGranted "$second_ok"
[ "$second_ok" = "0" ] && emit PASS || { blocker "a second deployment fingerprint was activated on the same licence"; emit FAIL; }
