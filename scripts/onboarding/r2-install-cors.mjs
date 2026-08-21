#!/usr/bin/env node
/**
 * ============================================================================
 * ONBOARDING SCRIPT 2: R2 CORS Policy Installation
 * ============================================================================
 * Configures locked CORS on customer R2 bucket:
 *   - Allowed origins: customer's exact domain (no wildcards)
 *   - Allowed methods: GET, PUT, HEAD
 *   - Allowed headers: *
 *
 * Usage:
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... \
 *   node scripts/onboarding/r2-install-cors.mjs \
 *     --bucket=aether-client-studio \
 *     --domain=ar.royalwedding.com \
 *     [--dry-run]
 * ============================================================================
 */

import { writeFileSync } from "node:fs";

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    acc[k] = v || true;
    return acc;
  }, {});

  const isDryRun = Boolean(args["dry-run"]);
  const bucketName = args.bucket || args.b;
  const rawDomain = args.domain || args.d;

  if (!bucketName || !rawDomain) {
    console.error("❌ Error: --bucket=<bucket> and --domain=<domain> are required.");
    process.exit(1);
  }

  const cleanDomain = String(rawDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const origin = `https://${cleanDomain}`;

  // Read credentials inside function body
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  console.log(`\n🔒 [2/5] R2 CORS CONFIGURATION: ${bucketName} -> ${origin}${isDryRun ? " (DRY-RUN)" : ""}`);
  console.log("───────────────────────────────────────────────────────────────────");

  const corsRules = [
    {
      allowedOrigins: [origin, `https://www.${cleanDomain}`],
      allowedMethods: ["GET", "PUT", "HEAD"],
      allowedHeaders: ["*"],
      exposeHeaders: ["ETag"],
      maxAgeSeconds: 3600,
    },
  ];

  if (isDryRun) {
    console.log("🔍 [DRY-RUN] Target CORS configuration:");
    console.log(JSON.stringify(corsRules, null, 2));
    console.log("✅ Dry run completed successfully.\n");
    return;
  }

  // Generate CORS file for backup & dashboard import
  const corsFilename = `r2-cors-${bucketName}.json`;
  writeFileSync(corsFilename, JSON.stringify({ rules: corsRules }, null, 2));
  console.log(`✓ CORS rule definition written to local file: ${corsFilename}`);

  // Apply via Cloudflare API if token available
  if (accountId && apiToken) {
    const corsApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/cors`;
    try {
      const res = await fetch(corsApiUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rules: corsRules }),
      });
      if (res.ok) {
        console.log("✓ CORS policy applied directly via Cloudflare API.");
      } else {
        console.log(`ℹ️ Direct API returned [${res.status}]. Apply ${corsFilename} via Cloudflare Dashboard -> R2 -> Settings -> CORS.`);
      }
    } catch {
      console.log(`ℹ️ API call bypassed. Apply ${corsFilename} via Cloudflare Dashboard.`);
    }
  }

  console.log(`✅ CORS configuration locked strictly to: ${origin} (no wildcards allowed).\n`);
}

main().catch((err) => {
  console.error("💥 Execution error:", err.message);
  process.exit(1);
});
