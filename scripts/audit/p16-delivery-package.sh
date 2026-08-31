#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p16 "Delivery Package"
cd "$AUDIT_ROOT"
fail=0
for f in scripts/strip-client-app.sh scripts/verify-client-branch.mjs scripts/generate-delivery-manifest.mjs \
         scripts/sign-manifest.mjs supabase/client-schema.sql CLIENT_README.md LICENSE_AGREEMENT.md HANDOVER.md; do
  [ -f "$f" ] || { blocker "missing delivery artifact: $f"; fail=1; }
done
grep -q 'is_approved' supabase/client-schema.sql || { blocker "client schema does not define public.is_approved before its policies"; fail=1; }
metric deliveryFilesChecked 8
[ "$fail" -eq 0 ] && emit PASS || emit FAIL
