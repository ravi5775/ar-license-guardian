#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — CLIENT ONBOARDING & PROVISIONING AUTOMATION
 * ============================================================================
 * 
 * Automates the 3-step client setup:
 *  1. Generates a unique, cryptographically secure License Key.
 *  2. Configures the dedicated database connection & client-schema guidance.
 *  3. Generates the exact `.env` file with isolated `R2_PREFIX`.
 * 
 * Usage:
 *   node scripts/provision-client.mjs --name="Royal Wedding Studio" --domain="ar.royalwedding.com" --slug="royal-wedding"
 * ============================================================================
 */

import { randomBytes } from "crypto";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, "").split("=");
  acc[k] = v || true;
  return acc;
}, {});

const clientName = args.name || "Sample Client Studio";
const clientDomain = (args.domain || "ar.clientstudio.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
const clientSlug = (args.slug || clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "");
const plan = args.plan || "pro";

console.log("\n============================================================");
console.log(`🚀 Provisioning Aether AR Client: ${clientName}`);
console.log("============================================================\n");

// 1. Generate formatted license key: AETH-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `AETH-${part()}-${part()}-${part()}`;
}

const licenseKey = generateLicenseKey();
const r2Prefix = `clients/${clientSlug}/`;

console.log("📋 [Step 1/3] Generated Client Credentials:");
console.log(`   • Client Name:    ${clientName}`);
console.log(`   • Domain:         ${clientDomain}`);
console.log(`   • Client Slug:    ${clientSlug}`);
console.log(`   • License Key:    ${licenseKey}`);
console.log(`   • R2 Prefix:      ${r2Prefix}`);
console.log(`   • Plan:           ${plan}\n`);

// 2. Generate Client .env template
const clientEnvContent = `# ============================================================================
# AETHER AR — CONFIGURATION FOR: ${clientName.toUpperCase()}
# Generated on: ${new Date().toISOString()}
# Domain: ${clientDomain}
# ============================================================================

RUNTIME=edge
DB_DRIVER=neon
RATELIMIT_DRIVER=memory
LICENCE_ROLE=client
NODE_ENV=production

# --- Database Connection (Neon Postgres) ---
# Create a free project at https://neon.tech, run supabase/client-schema.sql in SQL Editor,
# and paste your pooled connection string below:
DATABASE_URL=postgres://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# --- Shared Master Cloudflare R2 Media Storage ---
R2_ACCOUNT_ID=${process.env.R2_ACCOUNT_ID || "your-master-r2-account-id"}
R2_BUCKET=${process.env.R2_BUCKET || "aether-media"}
R2_PREFIX=${r2Prefix}
R2_ACCESS_KEY_ID=${process.env.R2_ACCESS_KEY_ID || "your-r2-access-key-id"}
R2_SECRET=${process.env.R2_SECRET || "your-r2-secret"}
R2_PUBLIC_BASE_URL=${process.env.R2_PUBLIC_BASE_URL || "https://media.your-domain.com"}

# --- Anti-Resale Licensing Guardian ---
VITE_LICENCE_API_URL=${process.env.ADMIN_BASE_URL || "https://admin.your-domain.com"}
VITE_LICENCE_KEY=${licenseKey}
VITE_LICENCE_PUBLIC_KEY=${process.env.LICENCE_PUBLIC_KEY_JWK || "your-ed25519-public-jwk"}
VITE_BUILD_ID=${clientSlug}-release-v1
`;

const outputPath = resolve(process.cwd(), `.env.${clientSlug}`);
writeFileSync(outputPath, clientEnvContent, "utf-8");

console.log("💾 [Step 2/3] Environment File Generated:");
console.log(`   • Written to: ${outputPath}\n`);

console.log("⚡ [Step 3/3] Deployment Quickstart Instructions:");
console.log("------------------------------------------------------------");
console.log(`1. Database Setup:`);
console.log(`   • Go to Neon (https://console.neon.tech) -> New Project.`);
console.log(`   • Open SQL Editor and execute the schema:`);
console.log(`     supabase/client-schema.sql`);
console.log(`   • Copy the Connection String and set it in .env.${clientSlug}`);
console.log("");
console.log(`2. Cloudflare Pages Deployment:`);
console.log(`   • In Cloudflare Dashboard -> Pages -> Create Application -> Connect to Git.`);
console.log(`   • Select Branch: 'client-app'`);
console.log(`   • Build Command: 'bun run build' or 'npm run build'`);
console.log(`   • Output Directory: 'dist'`);
console.log(`   • Add all Environment Variables from: .env.${clientSlug}`);
console.log(`   • Attach Custom Domain: ${clientDomain}`);
console.log("------------------------------------------------------------\n");
console.log("✅ Client provisioning package complete!\n");
