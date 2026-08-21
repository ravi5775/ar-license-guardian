#!/usr/bin/env node
/**
 * ============================================================================
 * ONBOARDING SCRIPT 1: R2 Bucket Creation & Lifecycle Setup
 * ============================================================================
 * Creates an isolated customer bucket in Cloudflare R2 and installs standard
 * lifecycle rules (e.g. 7-day auto-purge for temp/ folder).
 *
 * Usage:
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... \
 *   node scripts/onboarding/r2-create-bucket.mjs \
 *     --bucket=aether-client-studio \
 *     [--dry-run]
 * ============================================================================
 */

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    acc[k] = v || true;
    return acc;
  }, {});

  const isDryRun = Boolean(args["dry-run"]);
  const bucketName = args.bucket || args.b;

  if (!bucketName || typeof bucketName !== "string") {
    console.error("❌ Error: --bucket=<bucket_name> is required.");
    process.exit(1);
  }

  // Read credentials inside function body only
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error("❌ Error: CF_ACCOUNT_ID and CF_API_TOKEN environment variables are required.");
    process.exit(1);
  }

  console.log(`\n🪣 [1/5] R2 BUCKET PROVISIONING: ${bucketName}${isDryRun ? " (DRY-RUN)" : ""}`);
  console.log("───────────────────────────────────────────────────────────────────");

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`;
  const headers = {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  if (isDryRun) {
    console.log(`🔍 [DRY-RUN] Checking if bucket '${bucketName}' exists...`);
    console.log(`🔍 [DRY-RUN] Would create bucket '${bucketName}' if not present.`);
    console.log(`🔍 [DRY-RUN] Would configure lifecycle policy: delete 'temp/*' after 7 days.`);
    console.log("✅ Dry run completed successfully.\n");
    return;
  }

  // 1. Check if bucket already exists (Idempotent)
  const listRes = await fetch(baseUrl, { headers });
  if (!listRes.ok) {
    console.error(`❌ Failed to list R2 buckets: ${listRes.status} ${await listRes.text()}`);
    process.exit(1);
  }
  const listData = await listRes.json();
  const exists = (listData.result?.buckets || []).some((b) => b.name === bucketName);

  if (exists) {
    console.log(`ℹ️ Bucket '${bucketName}' already exists. Skipping creation.`);
  } else {
    console.log(`🚀 Creating bucket '${bucketName}'...`);
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: bucketName }),
    });
    if (!createRes.ok) {
      console.error(`❌ Failed to create bucket: ${createRes.status} ${await createRes.text()}`);
      process.exit(1);
    }
    console.log(`✓ Bucket '${bucketName}' created successfully.`);
  }

  // 2. Lifecycle rule (temp cleanup)
  console.log("⏳ Applying 7-day lifecycle purge rule for temp/ uploads...");
  const lifecycleUrl = `${baseUrl}/${bucketName}/lifecycle`;
  const lifecyclePolicy = {
    rules: [
      {
        id: "purge-temp-uploads",
        enabled: true,
        conditions: { prefix: "temp/" },
        action: { type: "Delete", maxAgeSeconds: 7 * 86400 },
      },
    ],
  };

  const lifecycleRes = await fetch(lifecycleUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(lifecyclePolicy),
  });

  if (lifecycleRes.ok) {
    console.log("✓ Lifecycle policy applied successfully.");
  } else {
    console.warn("⚠️ Note: Direct lifecycle API not enabled on standard plan; configure via dashboard if required.");
  }

  console.log("\n✅ R2 Bucket provisioning completed.");
  console.log(`  Bucket Name: ${bucketName}`);
  console.log("  Ensure bucket is set to PRIVATE (no public dev url).\n");
}

main().catch((err) => {
  console.error("💥 Execution error:", err.message);
  process.exit(1);
});
