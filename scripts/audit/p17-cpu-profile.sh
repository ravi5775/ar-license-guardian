#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p17 "CPU Profile & Bundle Treemap"
cd "$AUDIT_ROOT"
require_cmd node "profiler host"
dir=""
for c in dist/client .output/public/_build dist/_build .output/public dist; do [ -d "$c" ] && { dir="$c"; break; }; done
[ -n "$dir" ] || not_verified "no build output found - run 'bun run build' before this stage"
out="$ARTIFACT_DIR/p17-bundle.json"
node -e '
const fs=require("fs"),path=require("path");const root=process.argv[1];const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 e.isDirectory()?walk(p):files.push({file:p,bytes:fs.statSync(p).size});}})(root);
files.sort((a,b)=>b.bytes-a.bytes);
const js=files.filter(f=>f.file.endsWith(".js"));
// Vendored AR runtime (MindAR/A-Frame) is third-party, self-hosted for the
// anti-CDN requirement, and only fetched on AR routes. It is budgeted apart
// from application JS so a vendor drop-in cannot silently mask app bloat.
const isVendor=f=>f.file.includes("/vendor/");
const sum=a=>a.reduce((s,f)=>s+f.bytes,0);
fs.writeFileSync(process.argv[2],JSON.stringify({totalBytes:sum(files),
 jsBytes:sum(js),appJsBytes:sum(js.filter(f=>!isVendor(f))),
 vendorJsBytes:sum(js.filter(isVendor)),largest:files.slice(0,25)},null,2));
' "$dir" "$out"
artifact "artifacts/p17-bundle.json"
app=$(jqc -r '.appJsBytes' < "$out")
metric jsBytes "$(jqc -r '.jsBytes' < "$out")"
metric appJsBytes "$app"
metric vendorJsBytes "$(jqc -r '.vendorJsBytes' < "$out")"
metric totalBytes "$(jqc -r '.totalBytes' < "$out")"
limit=${AUDIT_JS_BUDGET_BYTES:-3000000}
[ "$app" -le "$limit" ] && emit PASS || { blocker "application JS $app bytes exceeds budget $limit"; emit FAIL; }
