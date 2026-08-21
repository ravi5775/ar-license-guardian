#!/usr/bin/env node
/**
 * ============================================================================
 * ONBOARDING SCRIPT 3: Cloudflare Pages Environment Setup
 * ============================================================================
 * Configures Cloudflare Pages project environment variables for production:
 *   - VITE_CUSTOMER_ID
 *   - VITE_BUILD_ID
 *   - VITE_RELEASE_HASH
 *   - VITE_LICENCE_KEY
 *   - VITE_LICENCE_API_URL
 *   - VITE_LICENCE_PUBLIC_KEY
 *   - DATABASE_URL
 *   - R2_*
 *
 * Usage:
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... \
 *   node scripts/onboarding/pages-install-env.mjs \
 *     --project=royal-wedding-app \
 *     --env-file=.env.client-royal-wedding \
 *     [--dry-run]
 * ============================================================================
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    acc[k] = v || true;
    return acc;
  }, {});

  const isDryRun = Boolean(args["dry-run"]);
  const projectName = args.project || args.p;
  const envFile = args["env-file"] || args.f;

  if (!projectName || !envFile) {
    console.error("❌ Error: --project=<pages_project_name> and --env-file=<path_to_env> are required.");
    process.exit(1);
  }

  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) {
    console.error(`❌ Error: Environment file not found at: ${envPath}`);
    process.exit(1);
  }

  // Parse env file
  const rawEnv = readFileSync(envPath, "utf-8");
  const envVars = {};
  for (const line of rawEnv.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = { value: val, type: key.includes("SECRET") || key.includes("KEY") || key.includes("PASSWORD") ? "secret_text" : "plain_text" };
    }
  }

  // Read credentials inside function body
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  console.log(`\n⚡ [3/5] CLOUDFLARE PAGES ENV CONFIGURATION: ${projectName}${isDryRun ? " (DRY-RUN)" : ""}`);
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`📄 Loaded ${Object.keys(envVars).length} variables from: ${envFile}`);

  if (isDryRun) {
    console.log("🔍 [DRY-RUN] Would configure the following environment variables in Pages:");
    for (const [k, v] of Object.entries(envVars)) {
      console.log(`   • ${k}: [${v.type}] ${v.type === "secret_text" ? "********" : v.value}`);
    }
    console.log("✅ Dry run completed successfully.\n");
    return;
  }

  if (!accountId || !apiToken) {
    console.warn("⚠️ CF_ACCOUNT_ID or CF_API_TOKEN not set in environment.");
    console.log("📋 Paste these environment variables into Cloudflare Dashboard -> Pages -> Settings -> Environment Variables:");
    for (const [k, v] of Object.entries(envVars)) {
      console.log(`${k}=${v.value}`);
    }
    console.log("\n✅ Manual copy-paste payload generated.\n");
    return;
  }

  // Update Cloudflare Pages Project Env
  const pagesUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`;
  const res = await fetch(pagesUrl, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deployment_configs: {
        production: {
          env_vars: envVars,
        },
      },
    }),
  });

  if (!res.ok) {
    console.error(`❌ Failed to update Pages project variables: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log(`✓ Successfully updated Cloudflare Pages production environment for '${projectName}'.`);
  console.log("✅ Environment configuration complete.\n");
}

main().catch((err) => {
  console.error("💥 Execution error:", err.message);
  process.exit(1);
});
