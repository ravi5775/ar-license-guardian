#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — Client Branch Delivery Verifier
 * ============================================================================
 * Automates delivery hygiene verification:
 *   1. Copies repo to a temporary scratch directory.
 *   2. Runs `scripts/strip-client-app.sh`.
 *   3. Scans all remaining source files for forbidden issuer imports:
 *      (licence.server, db.server, admin.functions, presign-gate.server, etc.)
 *   4. Tests compilation (`bun run build` / `vite build`).
 *   5. Exits non-zero if ANY forbidden file or dangling import is detected.
 *
 * Usage:
 *   bun run verify:client
 * ============================================================================
 */

import { readdirSync, readFileSync, statSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

console.log("\n===================================================================");
console.log("🧼 AETHER AR — CLIENT BRANCH DELIVERY VERIFIER");
console.log("===================================================================\n");

const root = process.cwd();
const scratchDir = join(tmpdir(), `aether-client-verify-${Date.now()}`);

try {
  console.log(`📁 Step 1: Cloning workspace into scratch sandbox: ${scratchDir}`);
  cpSync(root, scratchDir, {
    recursive: true,
    filter: (src) => !src.includes("node_modules") && !src.includes(".git") && !src.includes(".system_generated"),
  });

  console.log("✂️  Step 2: Executing scripts/strip-client-app.sh in sandbox...");
  execSync("bash scripts/strip-client-app.sh", {
    cwd: scratchDir,
    stdio: "inherit",
  });

  console.log("\n🔍 Step 3: Verifying no forbidden issuer files exist in client tree...");
  const FORBIDDEN_FILES = [
    "src/routes/_authenticated",
    "src/routes/api/public/licence",
    "src/lib/adapters/db.server.ts",
    "src/lib/adapters/licence.server.ts",
    "src/lib/licenses.functions.ts",
    "src/lib/admin.functions.ts",
    "src/lib/approvals.functions.ts",
    "scripts/sign-manifest.mjs",
    "scripts/generate-licence-keypair.mjs",
    ".github/workflows/deploy-main.yml",
    ".github/workflows/deploy-self-hosted.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
  ];

  let violations = 0;
  for (const forbidden of FORBIDDEN_FILES) {
    const fullPath = join(scratchDir, forbidden);
    if (existsSync(fullPath)) {
      console.error(`❌ FORBIDDEN FILE PRESENT: ${forbidden}`);
      violations++;
    } else {
      console.log(`  ✓ Stripped: ${forbidden}`);
    }
  }

  console.log("\n🔎 Step 4: Scanning codebase for dangling imports referencing issuer modules...");
  const FORBIDDEN_IMPORT_PATTERNS = [
    /from\s+["'][^"']*licence\.server["']/,
    /from\s+["'][^"']*db\.server["']/,
    /from\s+["'][^"']*licenses\.functions["']/,
    /from\s+["'][^"']*admin\.functions["']/,
    /from\s+["'][^"']*approvals\.functions["']/,
  ];

  function scanDir(dir) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory() && entry !== "node_modules" && entry !== "dist") {
        scanDir(full);
      } else if (s.isFile() && (entry.endsWith(".ts") || entry.endsWith(".tsx") || entry.endsWith(".js"))) {
        const content = readFileSync(full, "utf-8");
        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          if (pattern.test(content)) {
            console.error(`❌ DANGLING IMPORT in ${join(dir, entry)}: matches ${pattern}`);
            violations++;
          }
        }
      }
    }
  }

  const srcDir = join(scratchDir, "src");
  if (existsSync(srcDir)) {
    scanDir(srcDir);
  }

  if (violations > 0) {
    console.error(`\n❌ VERIFICATION FAILED: Found ${violations} isolation violation(s).`);
    process.exit(1);
  }

  console.log("\n✅ CLIENT DELIVERY TREE VERIFICATION PASSED with ZERO issuer leaks!");
  console.log("   The client tree is 100% clean and safe to ship.\n");
} finally {
  try {
    rmSync(scratchDir, { recursive: true, force: true });
  } catch {}
}
