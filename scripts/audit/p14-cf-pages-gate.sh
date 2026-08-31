#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p14 "Cloudflare Pages Staging Gate"
require_env CLOUDFLARE_API_TOKEN "read-only deployment-status token"
require_env CLOUDFLARE_ACCOUNT_ID "Cloudflare account id"
require_env CF_PAGES_PROJECT "Pages project name"
out="$ARTIFACT_DIR/p14-cf-deployments.json"
curl -s --max-time 20 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$CF_PAGES_PROJECT/deployments?per_page=1" > "$out"
artifact "artifacts/p14-cf-deployments.json"
ok=$(jqc -r '.success // false' < "$out")
[ "$ok" = "true" ] || not_verified "Cloudflare API did not accept the token"
metric_str latestDeployment "$(jqc -r '.result.0.latest_stage.status // "unknown"' < "$out")"
emit PASS
