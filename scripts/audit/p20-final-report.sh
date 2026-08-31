#!/usr/bin/env bash
# P20 aggregates every prior stage. It is the aggregator, so it is NEVER part of
# its own denominator. The canonical stage list below is the single source of
# truth: 21 aggregated stages (P00-P19 = 20 scripts, plus P09b) + P20 itself = 22.
source "$(dirname "$0")/_lib.sh"
stage_init p20 "Final Report"
cd "$AUDIT_ROOT"

STAGES=(p00 p01 p02 p03 p04 p05 p06 p07 p08 p09 p09b p10 p11 p12 p13 p14 p15 p16 p17 p18 p19)

pass=0; fail=0; nv=0; missing=0
rows=""
for s in "${STAGES[@]}"; do
  f="$ARTIFACT_DIR/${s}-result.json"
  if [ -f "$f" ]; then
    status=$(node -e 'console.log(require(process.argv[1]).status)' "$f" 2>/dev/null || echo MISSING)
    name=$(node -e 'console.log(require(process.argv[1]).name||"")' "$f" 2>/dev/null || echo "")
  else
    status=MISSING; name=""
  fi
  case "$status" in
    PASS) pass=$((pass+1)) ;;
    FAIL) fail=$((fail+1)) ;;
    NOT_VERIFIED) nv=$((nv+1)) ;;
    *) missing=$((missing+1)) ;;
  esac
  rows="${rows}| ${s^^} | ${name} | ${status} |"$'\n'
done

total=${#STAGES[@]}
# Stages that never ran count against the score exactly like NOT_VERIFIED.
score=$(( pass * 100 / total ))

if [ "$fail" -eq 0 ] && [ "$nv" -eq 0 ] && [ "$missing" -eq 0 ]; then
  verdict=PASS
elif [ "$fail" -eq 0 ] && [ "$score" -ge 80 ]; then
  verdict=CONDITIONAL_PASS
else
  verdict=FAIL
fi

report="$ARTIFACT_DIR/p20-executive-report.md"
{
  echo "# Aether AR — Audit Executive Report"
  echo
  echo "- Commit: \`$(git rev-parse HEAD 2>/dev/null || echo unknown)\`"
  echo "- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Total stages aggregated: **$total** (P00–P19 plus P09b; P20 is the aggregator and is excluded from its own denominator)"
  echo "- PASS: $pass · FAIL: $fail · NOT_VERIFIED: $nv · NOT RUN: $missing"
  echo "- Score: **${score}%**"
  echo "- Verdict: **$verdict**"
  echo
  echo "| Stage | Name | Status |"
  echo "| --- | --- | --- |"
  printf '%s' "$rows"
  echo
  echo "Verdict rule: PASS requires 100% PASS with zero FAIL and zero NOT_VERIFIED."
  echo "CONDITIONAL_PASS requires score ≥ 80% with zero FAIL. Anything else is FAIL."
  echo
  echo "Stages that stay NOT_VERIFIED in CI by design are documented in docs/audit-ci-scope.md."
} > "$report"
artifact "artifacts/p20-executive-report.md"

metric totalStagesAggregated "$total"
metric passed "$pass"
metric failed "$fail"
metric notVerified "$nv"
metric notRun "$missing"
metric scorePercent "$score"
metric_str verdict "$verdict"

cat "$report"

case "$verdict" in
  PASS) emit PASS ;;
  CONDITIONAL_PASS) blocker "$((nv+missing)) stage(s) unverified — see report"; emit NOT_VERIFIED ;;
  *) blocker "$fail stage(s) failed, score ${score}%"; emit FAIL ;;
esac
