#!/usr/bin/env bash
# =============================================================================
# AETHER AR — CLIENT-APP STRIP SCRIPT (Security Hardening Edition)
# =============================================================================
# Produces a clean client-app delivery tree from `main`. Run on the
# client-app branch after merging from main:
#
#   git checkout client-app
#   git merge main --no-ff
#   ./scripts/strip-client-app.sh
#   git add -A && git commit -m "chore: strip issuer layer for client-app"
#
# NEVER ship these files to a paying customer. Each section is annotated
# with the risk it mitigates.
# =============================================================================
set -e

echo "==================================================================="
echo "AETHER AR — client-app strip (security hardening edition)"
echo "==================================================================="

# ─── §RE-2: Issuer APIs & adapters ────────────────────────────────────────
# Removes the license-issuing server code so a client cannot restore the
# issuer from the delivered repo — even via git history (new history is
# created by the delivery workflow).
rm -rf src/routes/_authenticated
rm -rf src/routes/api/public/licence
rm -f  src/lib/adapters/db.server.ts
rm -f  src/lib/adapters/licence.server.ts
rm -f  src/lib/licenses.functions.ts
rm -f  src/lib/admin.functions.ts
rm -f  src/lib/approvals.functions.ts
echo "  ✓ Issuer APIs removed"

# ─── §RE-8: CI/CD internals ───────────────────────────────────────────────
# Removes internal deployment workflows. The client sets up their own
# Cloudflare Pages deployment manually or via the install guide.
rm -f  .github/workflows/deploy-main.yml
rm -f  .github/workflows/deploy-self-hosted.yml
rm -f  .github/workflows/ci.yml        # internal CI — not needed by client
rm -f  .github/workflows/codeql.yml    # internal SAST — not needed by client
rm -f  .github/workflows/dr-verify.yml # internal DR — not needed by client
echo "  ✓ CI/CD workflows removed"

# ─── §RE-1: Build signing / manifest (issuer-only) ────────────────────────
# sign-manifest.mjs reads LICENCE_PRIVATE_KEY_JWK — issuer server only.
# The client receives the compiled output; they must not be able to re-sign.
rm -f  scripts/sign-manifest.mjs
rm -f  scripts/generate-licence-keypair.mjs   # key generation — issuer only
rm -f  scripts/post-deploy-smoke.mjs          # internal smoke tests
rm -f  scripts/check-r2-usage.mjs             # admin usage monitor
rm -f  scripts/backup-to-r2.sh                # admin backup script
rm -f  scripts/verify-restore.sh              # admin DR verify script
echo "  ✓ Signing & admin scripts removed"

# ─── §RE-7: Admin migrations ──────────────────────────────────────────────
# Supabase migrations reveal internal schema structure and contain admin-only
# tables (licenses, violations, gate_events). Client gets client-schema.sql only.
rm -rf supabase/migrations
echo "  ✓ Admin migrations removed"

# ─── §RE-9: Vendor worker (issuer-side edge proxy) ────────────────────────
rm -rf vendor-worker
echo "  ✓ Vendor worker removed"

# ─── §RE-6: Env file sanitisation ─────────────────────────────────────────
# Replace .env.example with a client-only version (no issuer vars).
# The client .env.client.example is the correct reference.
if [ -f ".env.client.example" ]; then
  cp .env.client.example .env.example
  echo "  ✓ .env.example replaced with client-only template"
fi
# Remove any env files that might have snuck in
rm -f .env .env.production .env.branches.example
echo "  ✓ Sensitive env files removed"

# ─── §RE-13: Audit & deploy directories ──────────────────────────────────
rm -rf audit/
rm -rf deploy/  # self-hosted deployment configs — admin only
rm -rf docs/    # internal runbooks reveal infrastructure details
echo "  ✓ Audit/deploy/docs directories removed"

# ─── Verify no import still references removed files ─────────────────────
echo ""
echo "Checking for broken imports..."
BROKEN=$(grep -rn "licence\.server\|db\.server\|licenses\.functions\|admin\.functions\|approvals\.functions\|sign-manifest" src/ 2>/dev/null || true)
if [ -n "$BROKEN" ]; then
  echo "  ⚠ BROKEN IMPORT REFERENCES FOUND:"
  echo "$BROKEN"
  echo "  Fix these before committing the client-app branch."
  exit 1
else
  echo "  ✓ No broken imports detected"
fi

echo ""
echo "==================================================================="
echo "  client-app strip complete."
echo "  Next: create a fresh repo with git init + single squash commit"
echo "  so no prior history is delivered:"
echo ""
echo "    cd /tmp && git init client-delivery"
echo "    cp -r <repo>/. client-delivery/"
echo "    cd client-delivery && git add -A"
echo "    git commit -m 'Initial release — Aether AR vX.Y.Z'"
echo "    # Deliver client-delivery/ — NOT the main repo"
echo "==================================================================="
