#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p17 "CPU Profile & Bundle Treemap"
cd "$AUDIT_ROOT"
require_cmd node "profiler host"
dir=""
for c in .output/public/_build dist/_build dist .output/public; do [ -d "$c" ] && { dir="$c"; break; }; done
[ -n "$dir" ] || not_verified "no build output found - run 'bun run build' before this stage"
out="$ARTIFACT_DIR/p17-bundle.json"
node -e '
const fs=require("fs"),path=require("path");const root=process.argv[1];const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 e.isDirectory()?walk(p):files.push({file:p,bytes:fs.statSync(p).size});}})(root);
files.sort((a,b)=>b.bytes-a.bytes);
const js=files.filter(f=>f.file.endsWith(".js"));
fs.writeFileSync(process.argv[2],JSON.stringify({totalBytes:files.reduce((s,f)=>s+f.bytes,0),
 jsBytes:js.reduce((s,f)=>s+f.bytes,0),largest:files.slice(0,25)},null,2));
' "$dir" "$out"
artifact "artifacts/p17-bundle.json"
js=$(jqc -r '.jsBytes' < "$out")
metric jsBytes "$js"
metric totalBytes "$(jqc -r '.totalBytes' < "$out")"
limit=${AUDIT_JS_BUDGET_BYTES:-6000000}
[ "$js" -le "$limit" ] && emit PASS || { blocker "client JS $js bytes exceeds budget $limit"; emit FAIL; }
