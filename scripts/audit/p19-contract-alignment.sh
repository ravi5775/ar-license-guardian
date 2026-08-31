#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p19 "Contract Alignment"
cd "$AUDIT_ROOT"
fail=0
for f in LICENSE_AGREEMENT.md DPA.md SECURITY.md docs/anti-resale.md docs/licence-enforcement.md docs/disaster-recovery.md; do
  [ -f "$f" ] || { blocker "missing contract/compliance document: $f"; fail=1; }
done
grep -qi 'one-time' LICENSE_AGREEMENT.md 2>/dev/null || { blocker "licence agreement does not state the one-time-fee model"; fail=1; }
grep -qi 'resale\|redistribut' LICENSE_AGREEMENT.md 2>/dev/null || { blocker "licence agreement has no resale/redistribution clause"; fail=1; }
metric documentsChecked 6
[ "$fail" -eq 0 ] && emit PASS || emit FAIL
