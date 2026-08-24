#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — Admin Bootstrap Script
 * ============================================================================
 * 
 * Safely provisions the initial platform admin without shipping hardcoded
 * defaults.
 * 
 * Guarantees:
 *  1. Requires an explicit `--email` argument.
 *  2. Generates a 32-character cryptographically secure random password.
 *  3. Idempotent: Refuses to run if an admin already exists in the database.
 *  4. Prints credentials ONCE to stdout and never persists them to disk.
 *  5. Sets user metadata to enforce password reset and TOTP enrolment on first login.
 * 
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   node scripts/bootstrap-admin.mjs --email=admin@your-domain.com
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

  const email = (args.email || args.e || process.argv[2])?.toString().trim();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    console.error("❌ Error: A valid --email argument is required.");
    console.error("Usage: node scripts/bootstrap-admin.mjs --email=admin@your-domain.com");
    process.exit(1);
  }

  // Read environment inside function body (never at module scope)
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\n===================================================================");
  console.log("🛡️  AETHER AR — PLATFORM ADMIN BOOTSTRAP");
  console.log("===================================================================\n");

  // Step 1: Idempotency Check — Check if ANY admin already exists in user_roles
  console.log("🔍 Checking existing platform administrators...");
  const { data: existingAdmins, error: adminCheckError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);

  if (adminCheckError) {
    console.error(`❌ Failed to query user_roles: ${adminCheckError.message}`);
    process.exit(1);
  }

  if (existingAdmins && existingAdmins.length > 0) {
    console.error("⛔ ABORTED: An administrator already exists in the system.");
    console.error("   For security, this bootstrap script only executes on uninitialized instances.");
    console.error("   To add additional admins, use the admin dashboard or invite system.");
    process.exit(1);
  }

  // Step 2: Generate 32-character cryptographically random password
  // (Using URL-safe charset with upper, lower, numbers, and symbols)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  const randomBuf = randomBytes(32);
  let generatedPassword = "";
  for (let i = 0; i < 32; i++) {
    generatedPassword += chars[randomBuf[i] % chars.length];
  }

  console.log(`👤 Creating admin account for: ${email}...`);

  // Step 3: Create or update the Supabase Auth user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      name: "Platform Administrator",
      force_password_change: true,
      totp_required: true,
      bootstrapped_at: new Date().toISOString(),
    },
  });

  if (createError) {
    console.error(`❌ Failed to create admin user: ${createError.message}`);
    process.exit(1);
  }

  const userId = userData.user.id;

  // Step 4: Ensure profile and role are created
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email,
      display_name: "Platform Administrator",
      approval_status: "approved",
    });

  if (profileError) {
    console.error(`⚠️ Warning: Profile upsert note: ${profileError.message}`);
  }

  // Step 5: Assign 'admin' role in user_roles
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({
      user_id: userId,
      role: "admin",
    }, { onConflict: "user_id,role" });

  if (roleError) {
    console.error(`❌ Failed to assign admin role: ${roleError.message}`);
    process.exit(1);
  }

  // Step 6: Output credentials ONCE to stdout
  console.log("\n✅ INITIAL PLATFORM ADMIN SUCCESSFULLY CREATED!");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`  Admin Email:     ${email}`);
  console.log(`  Admin Password:  ${generatedPassword}`);
  console.log("───────────────────────────────────────────────────────────────────");
  console.log("⚠️  IMPORTANT SECURITY INSTRUCTIONS:");
  console.log("  1. Copy this password immediately. It is NOT stored anywhere in plaintext.");
  console.log("  2. Log in at your admin domain and complete TOTP / 2FA setup.");
  console.log("  3. Clear your terminal scrollback buffer to prevent shoulder surfing.");
  console.log("───────────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("💥 Unexpected error:", err);
  process.exit(1);
});
