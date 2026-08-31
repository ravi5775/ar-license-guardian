#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p18 "Supply Chain Audit"
cd "$AUDIT_ROOT"
require_cmd osv-scanner "vulnerability scanner"
out="$ARTIFACT_DIR/p18-osv.json"
osv-scanner --format json --lockfile bun.lock . > "$out" 2>"$ARTIFACT_DIR/p18-osv.log" || true
artifact "artifacts/p18-osv.json"
crit=$(node -e '
try{const d=require(process.argv[1]);let n=0;
for(const r of d.results??[])for(const p of r.packages??[])for(const v of p.vulnerabilities??[]){
 const s=(v.database_specific?.severity??"").toUpperCase();if(s==="CRITICAL"||s==="HIGH")n++;}
console.log(n)}catch{console.log(-1)}' "$out")
[ "$crit" = "-1" ] && not_verified "osv-scanner produced no parseable report"
metric highOrCriticalVulns "$crit"
[ "$crit" -eq 0 ] && emit PASS || { blocker "$crit high/critical dependency vulnerabilities"; emit FAIL; }
