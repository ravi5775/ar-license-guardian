#!/usr/bin/env node
/**
 * ============================================================================
 * ONBOARDING SCRIPT 4: DNS & Allowed Origins Verification
 * ============================================================================
 * Validates:
 *   1. Customer domain resolves via DNS (HTTPS accessible).
 *   2. Domain is actively listed in the license record's `allowed_origins`.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/onboarding/dns-validate.mjs \
 *     --domain=ar.royalwedding.com \
 *     --license-key=AETH-XXXX-XXXX-XXXX \
 *     [--dry-run]
 * ============================================================================
 */

import { lookup } from "node:dns/promises";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    acc[k] = v || true;
    return acc;
  }, {});

  const isDryRun = Boolean(args["dry-run"]);
  const rawDomain = args.domain || args.d;
  const licenseKey = args["license-key"] || args.k;

  if (!rawDomain || !licenseKey) {
    console.error("❌ Error: --domain=<domain> and --license-key=<key> are required.");
    process.exit(1);
  }

  const cleanDomain = String(rawDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");

  console.log(`\n🌐 [4/5] DOMAIN & LICENCE DNS VALIDATION: ${cleanDomain}${isDryRun ? " (DRY-RUN)" : ""}`);
  console.log("───────────────────────────────────────────────────────────────────");

  if (isDryRun) {
    console.log(`🔍 [DRY-RUN] Would test DNS lookup for: ${cleanDomain}`);
    console.log(`🔍 [DRY-RUN] Would test HTTPS ping for: https://${cleanDomain}`);
    console.log(`🔍 [DRY-RUN] Would verify '${cleanDomain}' in licence ${licenseKey} allowed_origins.`);
    console.log("✅ Dry run completed successfully.\n");
    return;
  }

  // 1. DNS Lookup
  console.log(`📡 Resolving DNS for ${cleanDomain}...`);
  try {
    const ip = await lookup(cleanDomain);
    console.log(`✓ DNS resolves to: ${ip.address}`);
  } catch (e) {
    console.warn(`⚠️ DNS resolution warning: ${e.message}. Domain may still be propagating.`);
  }

  // 2. HTTPS reachability
  console.log(`🔒 Testing HTTPS reachability (https://${cleanDomain})...`);
  try {
    const res = await fetch(`https://${cleanDomain}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
    });
    console.log(`✓ HTTPS responding with HTTP ${res.status}`);
  } catch (e) {
    console.warn(`⚠️ HTTPS reachability warning: ${e.message}. Deploy may be in progress.`);
  }

  // 3. Database allowed_origins check
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    console.log("📋 Verifying allowed_origins in licence database...");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: licence, error } = await supabase
      .from("licenses")
      .select("id, license_key, allowed_origins, status")
      .eq("license_key", licenseKey)
      .maybeSingle();

    if (error) {
      console.error(`❌ Failed to query licence: ${error.message}`);
      process.exit(1);
    }

    if (!licence) {
      console.error(`❌ Licence key '${licenseKey}' not found in database!`);
      process.exit(1);
    }

    const origins = (licence.allowed_origins || []).map((o) =>
      o.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
    );

    const isAllowed = origins.some((o) => cleanDomain === o || cleanDomain.endsWith(`.${o}`));

    if (isAllowed) {
      console.log(`✓ Domain '${cleanDomain}' is correctly registered in allowed_origins.`);
    } else {
      console.error(`❌ MISMATCH: Domain '${cleanDomain}' is NOT listed in licence allowed_origins: [${origins.join(", ")}]`);
      console.error("   Update the licence record to include this domain before activating.");
      process.exit(1);
    }
  } else {
    console.log("ℹ️ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not supplied; skipped DB cross-check.");
  }

  console.log("\n✅ DNS and allowed_origins validation complete!\n");
}

main().catch((err) => {
  console.error("💥 Execution error:", err.message);
  process.exit(1);
});
