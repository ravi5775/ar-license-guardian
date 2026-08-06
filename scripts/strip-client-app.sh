#!/usr/bin/env bash
# Produce the `client-app` tree from `main`. Deletions only — never edits —
# so merges from main stay trivial.
#
#   git checkout client-app && git merge main && ./scripts/strip-client-app.sh
set -euo pipefail

rm -rf src/routes/_authenticated
rm -rf src/routes/api/public/licence
rm -f  src/lib/adapters/db.server.ts
rm -f  src/lib/adapters/licence.server.ts
rm -f  src/lib/licenses.functions.ts
rm -f  src/lib/admin.functions.ts
rm -f  src/lib/approvals.functions.ts
rm -rf vendor-worker

echo "client-app tree prepared. Verify no import references the removed files:"
grep -rn "licence.server\|db.server\|licenses.functions" src || echo "  clean"
