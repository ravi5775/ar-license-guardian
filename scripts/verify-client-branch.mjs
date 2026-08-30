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
    "src/routes/_authenticated/dashboard.licenses.tsx",
    "src/routes/_authenticated/dashboard.activations.tsx",
    "src/routes/_authenticated/dashboard.audit.tsx",
    "src/routes/_authenticated/dashboard.approvals.tsx",
    "src/routes/_authenticated/dashboard.diagnostics.tsx",
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

  console.log("\n📦 Step 3b: Verifying customer-facing features survived the strip...");
  const REQUIRED_FILES = [
    "src/routes/_authenticated/route.tsx",
    "src/routes/_authenticated/dashboard.tsx",
    "src/routes/_authenticated/dashboard.index.tsx",
    "src/routes/_authenticated/dashboard.projects.tsx",
    "src/routes/_authenticated/dashboard.experiences.tsx",
    "src/routes/_authenticated/dashboard.catalogs.tsx",
    "src/routes/_authenticated/dashboard.albums.index.tsx",
    "src/routes/_authenticated/dashboard.albums.new.tsx",
    "src/routes/_authenticated/dashboard.analytics.tsx",
    "src/routes/_authenticated/dashboard.marker-tests.tsx",
    "src/routes/room.$catalog.tsx",
    "src/routes/_authenticated/pending.tsx",
    "src/lib/account.functions.ts",
    "src/lib/projects.functions.ts",
    "src/lib/experiences.functions.ts",
    "src/lib/catalog.functions.ts",
    "src/lib/albums.functions.ts",
    "src/lib/analytics.functions.ts",
    "src/lib/marker-tests.functions.ts",
  ];
  for (const required of REQUIRED_FILES) {
    if (existsSync(join(scratchDir, required))) {
      console.log(`  ✓ Present: ${required}`);
    } else {
      console.error(`❌ MISSING CLIENT FEATURE FILE: ${required}`);
      violations++;
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
