#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — License Activation Wizard (Admin-side CLI)
 * ============================================================================
 * One-command license activation for a new client:
 *   1. Validates that the client domain resolves + HTTPS works.
 *   2. Calls the admin /api/admin/licences endpoint to create the licence.
 *   3. Prints the activation payload for pasting into Cloudflare Pages env.
 *
 * Usage (run from vendor's admin machine, not shipped to clients):
 *   ADMIN_API_URL=https://admin.yourdomain.com \
 *   ADMIN_API_SECRET=<secret> \
 *   node scripts/activate-license.mjs \
 *     --customer-id=<uuid> \
 *     --domain=ar.royalwedding.com \
 *     --plan=pro \
 *     --seats=2 \
 *     --expiry=2027-08-21
 *
 * Requires:
 *   ADMIN_API_URL        Base URL of the admin server (main branch)
 *   ADMIN_API_SECRET     Bearer token for admin API
 * ============================================================================
 */

const ADMIN_API_URL = process.env.ADMIN_API_URL?.replace(/\/+$/, "");
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET;

const args = process.argv.slice(2).reduce((a, v) => {
  const [k, val] = v.replace(/^--/, "").split("=");
  a[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  return a;
}, {});

const { customerId, domain, plan = "pro", seats = "2", expiry } = args;

if (!ADMIN_API_URL || !ADMIN_API_SECRET || !customerId || !domain) {
  console.error([
    "Usage: ADMIN_API_URL=<url> ADMIN_API_SECRET=<secret>",
    "       node scripts/activate-license.mjs",
    "         --customer-id=<uuid>",
    "         --domain=<client-domain>",
    "         --plan=pro|basic|enterprise",
    "         --seats=<n>",
    "         --expiry=YYYY-MM-DD",
  ].join("\n"));
  process.exit(1);
}

const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

console.log("\n🔑 Aether AR — License Activation Wizard");
console.log("─────────────────────────────────────────────────────");
console.log(`   Customer ID: ${customerId}`);
console.log(`   Domain:      ${cleanDomain}`);
console.log(`   Plan:        ${plan}`);
console.log(`   Seats:       ${seats}`);
console.log(`   Expiry:      ${expiry ?? "1 year from today"}`);
console.log("─────────────────────────────────────────────────────\n");

// ─── Step 1: Domain validation ──────────────────────────────────────────────
console.log("Step 1/3: Validating domain...");
try {
  const res = await fetch(`https://${cleanDomain}/`, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (res.ok || [301, 302, 307, 308].includes(res.status)) {
    console.log(`  ✓ Domain reachable (HTTP ${res.status})`);
  } else {
    console.warn(`  ⚠ Domain returned HTTP ${res.status} — proceeding anyway`);
  }
} catch (e) {
  console.warn(`  ⚠ Domain not reachable: ${e.message}`);
  console.warn("    Proceeding — client may not have deployed yet.");
}

// ─── Step 2: Create the licence on admin server ─────────────────────────────
console.log("\nStep 2/3: Creating licence on admin server...");

const expiresAt = expiry
  ? new Date(expiry).toISOString()
  : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

const payload = {
  customerId,
  domain: cleanDomain,
  plan,
  maxSeats: parseInt(seats, 10),
  expiresAt,
};

let licenceData;
try {
  const res = await fetch(`${ADMIN_API_URL}/api/admin/licences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ADMIN_API_SECRET}`,
      "X-Request-ID": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`  ✗ Admin API error [${res.status}]: ${JSON.stringify(body)}`);
    process.exit(1);
  }

  licenceData = body;
  console.log(`  ✓ Licence created: ${licenceData.licenceKey ?? licenceData.id}`);
} catch (e) {
  console.error(`  ✗ Network error: ${e.message}`);
  console.error("    Is the admin server running and the ADMIN_API_SECRET correct?");
  process.exit(1);
}

// ─── Step 3: Print activation env vars ─────────────────────────────────────
console.log("\nStep 3/3: Activation complete.");
console.log("\n  ┌── Copy these into Cloudflare Pages env vars ──────────────────┐");
console.log(`  │  VITE_LICENCE_KEY=${licenceData.licenceKey ?? "(see admin dashboard)"}`);
console.log(`  │  VITE_LICENCE_API_URL=${ADMIN_API_URL}`);
console.log(`  │  VITE_LICENCE_PUBLIC_KEY=(paste Ed25519 public JWK from admin dashboard)`);
console.log(`  │  VITE_CUSTOMER_ID=${customerId}`);
console.log("  └────────────────────────────────────────────────────────────────┘\n");

console.log("✅ License activation complete.");
console.log(`   Expires: ${expiresAt}`);
console.log("   The client can now deploy and activate their build.\n");
