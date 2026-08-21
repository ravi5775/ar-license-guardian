#!/usr/bin/env node
/**
 * ============================================================================
 * ONBOARDING SCRIPT 5: License Creation Wizard
 * ============================================================================
 * Creates a verified license record in Supabase:
 *   - customer_id (UUID v4)
 *   - client_name & client_email
 *   - allowed_origins (locked domain list)
 *   - device caps (allowed_mobile, allowed_desktop)
 *   - grace_hours (per plan tier)
 *   - status: active
 * Prints the license key ONCE to stdout.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/onboarding/license-wizard.mjs \
 *     --name="Royal Wedding Studio" \
 *     --email="contact@royalwedding.com" \
 *     --domain="ar.royalwedding.com" \
 *     [--customer-id=...] \
 *     [--plan=pro] \
 *     [--mobile=1] \
 *     [--desktop=1] \
 *     [--dry-run]
 * ============================================================================
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    acc[k] = v || true;
    return acc;
  }, {});

  const isDryRun = Boolean(args["dry-run"]);
  const clientName = args.name || args.n;
  const clientEmail = args.email || args.e;
  const rawDomain = args.domain || args.d;
  const plan = args.plan || "pro";
  const mobileSlots = parseInt(args.mobile || "1", 10);
  const desktopSlots = parseInt(args.desktop || "1", 10);

  if (!clientName || !clientEmail || !rawDomain) {
    console.error("❌ Error: --name, --email, and --domain are required.");
    console.error("Usage: node scripts/onboarding/license-wizard.mjs --name='Studio' --email='a@b.com' --domain='ar.studio.com'");
    process.exit(1);
  }

  const cleanDomain = String(rawDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Customer ID
  const customerId = args["customer-id"] || randomBytes(16).toString("hex").replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    "$1-$2-$3-$4-$5"
  );

  // Generate License Key: AETH-XXXX-XXXX-XXXX
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  const licenseKey = `AETH-${part()}-${part()}-${part()}`;

  const graceHours = plan === "basic" ? 12 : plan === "enterprise" ? 48 : 24;

  console.log(`\n🔑 [5/5] LICENCE CREATION WIZARD: ${clientName}${isDryRun ? " (DRY-RUN)" : ""}`);
  console.log("───────────────────────────────────────────────────────────────────");

  const licenceRecord = {
    license_key: licenseKey,
    client_name: clientName,
    client_email: clientEmail,
    plan,
    status: "active",
    allowed_origins: [`https://${cleanDomain}`, cleanDomain],
    allowed_mobile: mobileSlots,
    allowed_desktop: desktopSlots,
    grace_hours: graceHours,
    notes: `Customer ID: ${customerId} | Provisioned via onboarding wizard`,
    created_at: new Date().toISOString(),
  };

  if (isDryRun) {
    console.log("🔍 [DRY-RUN] Target Licence Record to insert:");
    console.log(JSON.stringify(licenceRecord, null, 2));
    console.log(`🔑 [DRY-RUN] Generated Licence Key: ${licenseKey}`);
    console.log("✅ Dry run completed successfully.\n");
    return;
  }

  // Read credentials inside function body
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("licenses")
    .insert(licenceRecord)
    .select("id, license_key, plan, status")
    .single();

  if (error) {
    console.error(`❌ Failed to insert licence: ${error.message}`);
    process.exit(1);
  }

  console.log("\n✅ LICENCE CREATED SUCCESSFULLY!");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`  Customer ID:       ${customerId}`);
  console.log(`  Licence Key:       ${licenseKey}`);
  console.log(`  Client Domain:     ${cleanDomain}`);
  console.log(`  Plan Tier:         ${plan}`);
  console.log(`  Grace Window:      ${graceHours} hours`);
  console.log(`  Allowed Devices:   ${mobileSlots} mobile + ${desktopSlots} desktop`);
  console.log("───────────────────────────────────────────────────────────────────");
  console.log("⚠️  Copy the Licence Key now to provide to your client.\n");
}

main().catch((err) => {
  console.error("💥 Execution error:", err.message);
  process.exit(1);
});
