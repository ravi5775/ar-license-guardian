#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p01 "Build & Static Quality"
cd "$AUDIT_ROOT"
require_cmd bun "JavaScript toolchain"
bunx eslint src --format json > "$ARTIFACT_DIR/p01-eslint-raw.json" 2>"$ARTIFACT_DIR/p01-eslint-err.txt"
artifact "artifacts/p01-eslint-raw.json"
read -r errors warnings <<<"$(node -e '
const d=require(process.argv[1]);let e=0,w=0;
for(const f of d) for(const m of f.messages) m.severity===2?e++:w++;
console.log(e,w)' "$ARTIFACT_DIR/p01-eslint-raw.json" 2>/dev/null || echo "-1 -1")"
[ "$errors" = "-1" ] && not_verified "eslint did not produce a parseable report"
metric eslintErrors "$errors"
metric eslintWarnings "$warnings"
tsc_out="$ARTIFACT_DIR/p01-typecheck.txt"
bunx tsc --noEmit > "$tsc_out" 2>&1; tsc_code=$?
artifact "artifacts/p01-typecheck.txt"
metric typecheckExit "$tsc_code"
[ "$errors" -gt 0 ] && blocker "eslint reported $errors error(s)"
[ "$tsc_code" -ne 0 ] && blocker "typecheck failed (exit $tsc_code)"
{ [ "$errors" -eq 0 ] && [ "$tsc_code" -eq 0 ]; } && emit PASS || emit FAIL
