#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p11 "Security & Abuse Controls"
cd "$AUDIT_ROOT"
require_cmd bun "test runner"
log="$ARTIFACT_DIR/p11-security-tests.txt"
bun test tests/security-headers.test.ts tests/security-critical-fixes.test.ts \
  tests/comprehensive-security-regression.test.ts tests/upload-security.test.ts \
  tests/rate-limiter.test.ts > "$log" 2>&1
code=$?
artifact "artifacts/p11-security-tests.txt"
pass=$(grep -Eo '[0-9]+ pass' "$log" | head -1 | grep -Eo '[0-9]+' || echo 0)
failn=$(grep -Eo '[0-9]+ fail' "$log" | head -1 | grep -Eo '[0-9]+' || echo 0)
metric testsPassed "${pass:-0}"
metric testsFailed "${failn:-0}"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-banner --redact -r "$ARTIFACT_DIR/p11-gitleaks.json" >/dev/null 2>&1
  metric gitleaksRan 1
  metric gitleaksFindings "$(jqc -r '. | length' < "$ARTIFACT_DIR/p11-gitleaks.json" 2>/dev/null || echo 0)"
else
  metric gitleaksRan 0
fi
[ "$code" -eq 0 ] && emit PASS || { blocker "$failn security test(s) failed"; emit FAIL; }
