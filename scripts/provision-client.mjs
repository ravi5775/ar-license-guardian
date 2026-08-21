#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — CLIENT ONBOARDING & PROVISIONING AUTOMATION (Hardened Edition)
 * ============================================================================
 *
 * Implements the "Pre-Sale Checklist" from the Seller Edition Security Guide:
 *  §RE-4  — Unique VITE_CUSTOMER_ID per build (leaked copy tracing)
 *  §RE-6  — Bootstrap admin password generated per install, never stored
 *  §RE-8  — Build fingerprint: VITE_BUILD_ID, VITE_CUSTOMER_ID, VITE_RELEASE_HASH
 *  §RE-7  — Grace hours configurable per licence tier
 *
 * Usage:
 *   node scripts/provision-client.mjs \
 *     --name="Royal Wedding Studio" \
 *     --domain="ar.royalwedding.com" \
 *     --slug="royal-wedding" \
 *     --plan="pro"
 * ============================================================================
 */

import { randomBytes, createHash } from "crypto";
import { writeFileSync } from "fs";
import { resolve } from "path";

// ─── Argument parsing ────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, "").split("=");
  acc[k] = v || true;
  return acc;
}, {});

if (!args.name || !args.domain) {
  console.error("Usage: provision-client.mjs --name=<name> --domain=<domain> [--slug=<slug>] [--plan=pro|basic|enterprise]");
  process.exit(1);
}

const clientName = args.name;
const clientDomain = (args.domain).replace(/^https?:\/\//, "").replace(/\/$/, "");
const clientSlug = (args.slug || clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "");
const plan = args.plan || "pro";
const now = new Date().toISOString();

// ─── §RE-4: Unique Customer ID (UUID v4) ─────────────────────────────────────
// Embedded in every compiled build. A leaked copy carries this ID and can be
// traced back to the customer who received it. Stored only in the Vendor DB.
const customerId = randomBytes(16).toString("hex").replace(
  /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
  "$1-$2-$3-$4-$5"
);

// ─── §RE-3: License key generation ───────────────────────────────────────────
function generateLicenseKey() {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `AETH-${part()}-${part()}-${part()}`;
}
const licenseKey = generateLicenseKey();

// ─── §RE-6: Bootstrap admin password ─────────────────────────────────────────
// Printed ONCE to stdout during provisioning. Never written to a file.
// The operator must copy it immediately and then clear the terminal.
const adminPassword = randomBytes(20).toString("base64url"); // 27+ char URL-safe

// ─── Build identifiers ───────────────────────────────────────────────────────
const buildId = `${clientSlug}-${Date.now()}`;
// VITE_RELEASE_HASH is filled in by scripts/sign-manifest.mjs after the bundle
// is built. It is left as a placeholder here so the env file is valid for build.
const releaseHashPlaceholder = "PENDING_POST_BUILD_SIGN";

// ─── Grace hours per plan tier ───────────────────────────────────────────────
const GRACE_BY_PLAN = { basic: 12, pro: 24, enterprise: 48 };
const graceHours = GRACE_BY_PLAN[plan] ?? 24;

// ─── R2 prefix ───────────────────────────────────────────────────────────────
const r2Prefix = `clients/${clientSlug}/`;

// ─── Announce ────────────────────────────────────────────────────────────────
console.log("\n===================================================================");
console.log(`🚀 Provisioning Aether AR Client: ${clientName}`);
console.log("===================================================================\n");
console.log("📋 Client Credentials:");
console.log(`   Customer ID:   ${customerId}    ← embed this; trace leaks`);
console.log(`   License Key:   ${licenseKey}`);
console.log(`   Build ID:      ${buildId}`);
console.log(`   Domain:        ${clientDomain}`);
console.log(`   Plan:          ${plan}  (grace: ${graceHours}h)`);
console.log(`   R2 Prefix:     ${r2Prefix}\n`);

// §RE-6 — Print bootstrap admin password ONCE, never store it
console.log("🔑 BOOTSTRAP ADMIN PASSWORD (copy now — not written to any file):");
console.log(`   ${adminPassword}`);
console.log("   ⚠ Set this in the admin panel immediately and then clear your terminal.\n");

// ─── Generate client .env ────────────────────────────────────────────────────
const clientEnv = `# ============================================================================
# AETHER AR — CONFIGURATION FOR: ${clientName.toUpperCase()}
# Generated: ${now}
# Customer ID: ${customerId}
# Domain: ${clientDomain}
# ============================================================================
# ⚠ This file contains a unique license key and customer ID.
# Do NOT share it with other studios or Aether AR will detect and revoke it.
# ============================================================================

RUNTIME=edge
DB_DRIVER=neon
RATELIMIT_DRIVER=memory
LICENCE_ROLE=client
NODE_ENV=production

# --- Offline grace hours (controlled by your plan tier: ${plan}) ---
VITE_LICENCE_GRACE_HOURS=${graceHours}

# --- Database (Neon Postgres) ---
# 1. Go to https://neon.tech → New Project
# 2. Run supabase/client-schema.sql in the SQL Editor
# 3. Paste the pooled connection string here:
DATABASE_URL=postgres://user:password@ep-REPLACE.us-east-2.aws.neon.tech/neondb?sslmode=require

# --- Cloudflare R2 Storage ---
# Create your own R2 bucket. DO NOT share these credentials.
R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_BUCKET=YOUR_BUCKET_NAME
R2_PREFIX=${r2Prefix}
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
R2_SECRET=YOUR_R2_SECRET
R2_PUBLIC_BASE_URL=https://media.${clientDomain}

# --- License Guardian (do not change these values) ---
VITE_LICENCE_API_URL=${process.env.ADMIN_BASE_URL || "https://admin.YOUR_VENDOR_DOMAIN.com"}
VITE_LICENCE_KEY=${licenseKey}
VITE_LICENCE_PUBLIC_KEY=${process.env.LICENCE_PUBLIC_KEY_JWK || "PASTE_ED25519_PUBLIC_JWK_HERE"}

# --- Build Fingerprint (auto-set by CI — do not edit manually) ---
# These values are baked into the compiled JS bundle.
# Changing them post-build will break the build integrity check.
VITE_CUSTOMER_ID=${customerId}
VITE_BUILD_ID=${buildId}
VITE_RELEASE_HASH=${releaseHashPlaceholder}
`;

const outputPath = resolve(process.cwd(), `.env.client-${clientSlug}`);
writeFileSync(outputPath, clientEnv, "utf-8");

console.log(`💾 Environment file written: ${outputPath}`);
console.log("   ⚠ This file is in .gitignore — never commit it.\n");

// ─── Vendor DB record (JSON for your admin dashboard) ─────────────────────
const vendorRecord = {
  customerId,
  clientName,
  clientDomain,
  clientSlug,
  licenseKey,
  buildId,
  plan,
  graceHours,
  r2Prefix,
  provisionedAt: now,
  status: "active",
};

const vendorRecordPath = resolve(process.cwd(), `.env.client-${clientSlug}.vendor.json`);
writeFileSync(vendorRecordPath, JSON.stringify(vendorRecord, null, 2), "utf-8");
console.log(`📊 Vendor record written: ${vendorRecordPath}`);
console.log("   → Register this customer in your admin DB before their first activation.\n");

// ─── Deployment instructions ─────────────────────────────────────────────────
console.log("⚡ Deployment Steps:");
console.log("──────────────────────────────────────────────────────────────────");
console.log(`1. Database: Neon → New Project → SQL Editor → run client-schema.sql`);
console.log(`   Update DATABASE_URL in .env.client-${clientSlug}`);
console.log("");
console.log(`2. Build: Set all VITE_* vars from .env.client-${clientSlug}`);
console.log(`   Run: bun run build`);
console.log(`   Run: LICENCE_PRIVATE_KEY_JWK=<key> BUILD_ID=${buildId} node scripts/sign-manifest.mjs dist/client`);
console.log(`   Set VITE_RELEASE_HASH to the assetDigest output`);
console.log(`   Rebuild: bun run build`);
console.log("");
console.log(`3. Cloudflare Pages → Create Application → Connect Git → Branch: client-app`);
console.log(`   Add all env vars from .env.client-${clientSlug}`);
console.log(`   Custom domain: ${clientDomain}`);
console.log("");
console.log(`4. Register in admin DB: POST /api/admin/clients with vendorRecord JSON`);
console.log("──────────────────────────────────────────────────────────────────");
console.log("✅ Provisioning package complete!\n");

