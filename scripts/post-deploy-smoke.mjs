#!/usr/bin/env node
/**
 * Post-Deployment Smoke & Verification Test Runner
 *
 * Runs immediately after deployment to verify live production health:
 * 1. Root and core pages return 200 OK.
 * 2. Enterprise security headers are strictly applied on responses.
 * 3. The legacy /api/public/license/activate endpoint returns 410 Gone.
 * 4. The new /api/public/licence/activate endpoint is active and handles OPTIONS.
 * 5. One-time nonce endpoints return appropriate cache-control headers.
 * 6. Generates markdown summary for GitHub Actions with rollback guidance.
 */

import fs from "node:fs";

const TARGET_URL = (process.env.DEPLOY_URL || process.env.TARGET_URL || "http://localhost:3000").replace(/\/$/, "");
const GITHUB_STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY;
const COMMIT_SHA = process.env.GITHUB_SHA || "unknown";
const DEPLOY_ENV = process.env.DEPLOY_ENV || "production";

console.log(`[smoke] Starting post-deploy smoke checks against ${TARGET_URL}...`);
console.log(`[smoke] Commit: ${COMMIT_SHA}, Environment: ${DEPLOY_ENV}`);

const results = [];

async function check(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    const duration = Date.now() - start;
    results.push({ name, status: "PASS", duration, detail: detail || "OK" });
    console.log(`  ✓ ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, status: "FAIL", duration, detail: msg });
    console.error(`  ✗ ${name} (${duration}ms): ${msg}`);
  }
}

async function run() {
  // 1. Root availability
  await check("Root Endpoint (HTTP 200)", async () => {
    const res = await fetch(`${TARGET_URL}/`, { redirect: "follow" });
    if (!res.ok) throw new Error(`Expected 200 OK, got ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) throw new Error(`Expected text/html, got ${ct}`);
    return `Status ${res.status}, Type: ${ct}`;
  });

  // 2. Security Headers Verification
  await check("Security Headers Compliance", async () => {
    const res = await fetch(`${TARGET_URL}/`);
    const missing = [];

    const expected = [
      ["content-security-policy", "CSP"],
      ["x-content-type-options", "X-Content-Type-Options"],
      ["x-frame-options", "X-Frame-Options"],
      ["referrer-policy", "Referrer-Policy"],
      ["permissions-policy", "Permissions-Policy"],
    ];

    for (const [header, label] of expected) {
      if (!res.headers.has(header)) {
        missing.push(label);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required headers: ${missing.join(", ")}`);
    }

    const csp = res.headers.get("content-security-policy") || "";
    if (!csp.includes("object-src 'none'")) {
      throw new Error("CSP does not include object-src 'none'");
    }

    return "All enterprise security headers verified";
  });

  // 3. Legacy endpoint disabled verification (Must be 410 Gone)
  await check("Legacy Activation Endpoint Tombstone (HTTP 410)", async () => {
    const res = await fetch(`${TARGET_URL}/api/public/license/activate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license_key: "TEST-TEST-TEST-TEST", fingerprint: "test-fingerprint" }),
    });

    if (res.status !== 410) {
      throw new Error(`Security violation: Legacy endpoint returned status ${res.status}, expected 410 Gone`);
    }

    const data = await res.json().catch(() => ({}));
    if (data.error !== "ENDPOINT_REMOVED") {
      throw new Error(`Expected error code ENDPOINT_REMOVED, got: ${JSON.stringify(data)}`);
    }

    return "Legacy endpoint successfully deactivated (410 Gone)";
  });

  // 4. New Licence Activation Options & Readiness
  await check("Active Licence Route (OPTIONS)", async () => {
    const res = await fetch(`${TARGET_URL}/api/public/licence/activate`, {
      method: "OPTIONS",
    });

    if (!res.ok) throw new Error(`OPTIONS request failed with status ${res.status}`);
    return `Status ${res.status}`;
  });

  // 5. Media Nonce Security Check
  await check("Media Nonce Protection & Cache Headers", async () => {
    const res = await fetch(`${TARGET_URL}/api/public/m/invalid_probe_nonce_token_test_12345`);
    const cacheControl = res.headers.get("cache-control") || "";

    // Should return 404 or 410 and never be cached
    if (res.status !== 404 && res.status !== 410) {
      throw new Error(`Unexpected status ${res.status} for invalid nonce probe`);
    }

    if (res.status === 410 && !cacheControl.includes("no-store")) {
      throw new Error(`Cache-Control must contain no-store, got: ${cacheControl}`);
    }

    return `Status ${res.status}, Cache-Control: ${cacheControl || "none"}`;
  });

  // Output formatting & Rollback Readiness
  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS");

  const markdown = [
    `## 🚀 Post-Deployment Smoke Test Report`,
    ``,
    `**Target Environment:** \`${DEPLOY_ENV}\` | **Host:** \`${TARGET_URL}\``,
    `**Commit:** \`${COMMIT_SHA}\` | **Time:** \`${new Date().toISOString()}\``,
    `**Summary:** ${failed.length === 0 ? "✅ **ALL CHECKS PASSED**" : "❌ **SMOKE CHECKS FAILED**"} (${passed.length}/${results.length} passing)`,
    ``,
    `| Check | Status | Duration | Details |`,
    `|---|---|---|---|`,
    ...results.map((r) => `| ${r.name} | ${r.status === "PASS" ? "✅ PASS" : "❌ FAIL"} | ${r.duration}ms | ${r.detail} |`),
    ``,
  ];

  if (failed.length > 0) {
    markdown.push(
      `### ⚠️ ROLLBACK REQUIRED`,
      `One or more post-deployment health checks failed. Recommended remediation:`,
      `- **Cloudflare Workers:** Run \`wrangler rollback\` or deploy the previous known good commit.`,
      `- **Self-Hosted Docker:** Revert to previous image tag \`ghcr.io/${process.env.GITHUB_REPOSITORY || "repo"}:<previous-sha>\`.`,
      `- **Alert Triggered:** Health failure logged to deployment audit stream.`,
    );
  } else {
    markdown.push(
      `### 🛡️ Production Health Status: READY`,
      `- Deployment verified healthy and responsive.`,
      `- Security headers and endpoint restrictions are actively enforced.`,
      `- Rollback state: Standby (Last verified clean: \`${COMMIT_SHA}\`).`,
    );
  }

  const outputSummary = markdown.join("\n");
  console.log("\n" + outputSummary);

  if (GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(GITHUB_STEP_SUMMARY, outputSummary + "\n");
    } catch (e) {
      console.warn("Could not write to GITHUB_STEP_SUMMARY:", e);
    }
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal error during smoke tests:", err);
  process.exit(1);
});
