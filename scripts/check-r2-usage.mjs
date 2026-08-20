#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — COMBINED R2 STORAGE USAGE & MULTI-TENANT MONITOR
 * ============================================================================
 * 
 * Scans the master Cloudflare R2 bucket and aggregates storage usage
 * by client prefix (`clients/{clientSlug}/`).
 * 
 * Flags warnings when approaching the Cloudflare R2 10 GB Free Tier limit.
 * 
 * Usage:
 *   node scripts/check-r2-usage.mjs
 * ============================================================================
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET;
const bucketName = process.env.R2_BUCKET || "aether-media";

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("❌ Missing Cloudflare R2 Credentials in environment.");
  console.error("Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

console.log("\n============================================================");
console.log(`📦 Scanning Cloudflare R2 Bucket: ${bucketName}`);
console.log("============================================================\n");

async function scanBucket() {
  const prefixUsage = new Map();
  let totalBytes = 0;
  let totalObjects = 0;
  let continuationToken = undefined;

  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });

      const response = await s3.send(command);
      const contents = response.Contents || [];

      for (const obj of contents) {
        const key = obj.Key || "";
        const size = obj.Size || 0;
        totalBytes += size;
        totalObjects++;

        // Extract prefix (e.g., "clients/royal-wedding/" or "root")
        const parts = key.split("/");
        const prefix = parts.length > 1 ? `${parts[0]}/${parts[1]}/` : "root/";

        const current = prefixUsage.get(prefix) || { bytes: 0, count: 0 };
        current.bytes += size;
        current.count += 1;
        prefixUsage.set(prefix, current);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Format output table
    console.log("-----------------------------------------------------------------------------");
    console.log(
      `${"Client Prefix".padEnd(35)} | ${"Files".padEnd(8)} | ${"Size (MB)".padEnd(12)} | ${"% of 10GB Free Tier"}`
    );
    console.log("-----------------------------------------------------------------------------");

    const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

    for (const [prefix, stats] of prefixUsage.entries()) {
      const sizeMb = (stats.bytes / (1024 * 1024)).toFixed(2);
      const pct = ((stats.bytes / FREE_TIER_BYTES) * 100).toFixed(2);
      console.log(
        `${prefix.padEnd(35)} | ${String(stats.count).padEnd(8)} | ${(sizeMb + " MB").padEnd(12)} | ${pct}%`
      );
    }

    console.log("-----------------------------------------------------------------------------");
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
    const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(3);
    const totalPct = ((totalBytes / FREE_TIER_BYTES) * 100).toFixed(2);

    console.log(`\n📊 TOTAL USAGE ACROSS ALL CLIENTS:`);
    console.log(`   • Total Objects: ${totalObjects}`);
    console.log(`   • Total Storage: ${totalMb} MB (${totalGb} GB)`);
    console.log(`   • Cloudflare 10 GB Free Tier Consumed: ${totalPct}%`);

    if (totalBytes > 8 * 1024 * 1024 * 1024) {
      console.log("\n⚠️ WARNING: Storage has exceeded 80% (8 GB) of the Cloudflare R2 Free Tier.");
      console.log("Consider purging test assets or upgrading to paid tier ($0.015/GB beyond 10GB).\n");
    } else {
      console.log("\n✅ Storage is well within the Cloudflare R2 10 GB Free Tier.\n");
    }
  } catch (error) {
    console.error("❌ Error querying R2 bucket:", error.message);
  }
}

scanBucket();
