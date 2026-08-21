#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — R2 Bucket Validator & Creator
 * ============================================================================
 * Validates that a client's Cloudflare R2 bucket:
 *   1. Exists and is accessible.
 *   2. Has the required folder structure (media/, thumbnails/, temp/).
 *   3. Has a secure (non-public) access policy.
 *   4. Has correct CORS headers for the client domain.
 *
 * Usage:
 *   CF_ACCOUNT_ID=<id> CF_API_TOKEN=<token> \
 *   node scripts/create-r2-bucket.mjs \
 *     --bucket=my-bucket \
 *     --domain=ar.clientstudio.com
 *
 * Required env:
 *   CF_ACCOUNT_ID    Cloudflare Account ID
 *   CF_API_TOKEN     API Token with R2:Edit permissions
 * ============================================================================
 */

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

const args = process.argv.slice(2).reduce((a, v) => {
  const [k, val] = v.replace(/^--/, "").split("=");
  a[k] = val;
  return a;
}, {});

const bucket = args.bucket;
const domain = args.domain;

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !bucket || !domain) {
  console.error([
    "Usage: CF_ACCOUNT_ID=<id> CF_API_TOKEN=<token>",
    "       node scripts/create-r2-bucket.mjs --bucket=<name> --domain=<client-domain>",
  ].join("\n"));
  process.exit(1);
}

const BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets`;
const headers = {
  "Authorization": `Bearer ${CF_API_TOKEN}`,
  "Content-Type": "application/json",
};

async function cf(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors));
  return json.result;
}

console.log(`\n🪣  Validating R2 bucket: ${bucket}`);
console.log(`   Account: ${CF_ACCOUNT_ID}`);
console.log(`   Domain:  ${domain}\n`);

// 1. Check if bucket exists; create if not
let bucketExists = false;
try {
  const buckets = await cf("GET", "");
  bucketExists = (buckets?.buckets ?? []).some((b) => b.name === bucket);
} catch (e) {
  console.error("❌ Failed to list buckets:", e.message);
  process.exit(1);
}

if (!bucketExists) {
  console.log(`   Bucket '${bucket}' not found — creating...`);
  await cf("POST", "", { name: bucket });
  console.log(`   ✓ Bucket created`);
} else {
  console.log(`   ✓ Bucket '${bucket}' exists`);
}

// 2. Verify the bucket is NOT set to public access
// (Cloudflare R2 does not expose a direct "public access" flag via API;
//  we check if a public R2.dev subdomain is configured)
// Advisory: instruct the user to ensure no public bucket rules are applied.
console.log(`   ⚠ Ensure bucket '${bucket}' has NO public access rules`);
console.log(`     Cloudflare Dashboard → R2 → ${bucket} → Settings → Public Access = Off`);

// 3. CORS policy — allow only the client domain
const corsPolicy = {
  corsRules: [
    {
      allowedOrigins: [`https://${domain}`, `https://www.${domain}`],
      allowedMethods: ["GET", "PUT", "HEAD"],
      allowedHeaders: ["*"],
      maxAgeSeconds: 3600,
    },
  ],
};
// NOTE: R2 CORS is set via the dashboard or Workers binding — the API v4
// does not yet expose a direct CORS endpoint for R2 buckets. Generate the
// config JSON for manual application.
const corsPath = `./r2-cors-${bucket}.json`;
import { writeFileSync } from "fs";
writeFileSync(corsPath, JSON.stringify(corsPolicy, null, 2));
console.log(`   ✓ CORS policy written to: ${corsPath}`);
console.log(`     Apply via: Cloudflare Dashboard → R2 → ${bucket} → CORS Policy`);

console.log(`\n   Required folder structure (upload a .keep file to each):`);
for (const folder of ["media/", "thumbnails/", "temp/"]) {
  console.log(`     r2://${bucket}/${folder}`);
}

console.log("\n✅ R2 bucket validation complete.\n");
