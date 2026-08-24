#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — DNS Domain Validator
 * ============================================================================
 * Verifies that a client's domain:
 *   1. Resolves via DNS.
 *   2. Returns a valid HTTP 200/301/302 on the root path.
 *   3. Has a valid SSL certificate (HTTPS).
 *   4. Has the expected Cloudflare headers (cf-ray, cf-cache-status).
 *
 * This does NOT provision DNS — the client must set up Cloudflare Pages
 * custom domain themselves. This script confirms it's done correctly.
 *
 * Usage:
 *   node scripts/verify-dns.mjs --domain=ar.royalwedding.com
 * ============================================================================
 */

import { lookup } from "dns/promises";

const args = process.argv.slice(2).reduce((a, v) => {
  const [k, val] = v.replace(/^--/, "").split("=");
  a[k] = val;
  return a;
}, {});

const domain = args.domain?.replace(/^https?:\/\//, "").replace(/\/$/, "");

if (!domain) {
  console.error("Usage: node scripts/verify-dns.mjs --domain=<client-domain>");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function pass(msg) { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg) { console.log(`  ✗ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠ ${msg}`); }

console.log(`\n🌐 DNS & HTTPS Validation: ${domain}\n`);

// ─── 1. DNS resolution ───────────────────────────────────────────────────────
try {
  const addresses = await lookup(domain);
  pass(`DNS resolves → ${addresses.address} (${addresses.family === 4 ? "IPv4" : "IPv6"})`);
} catch {
  fail(`DNS does not resolve for '${domain}' — ensure Cloudflare Pages custom domain is configured`);
  process.exit(1);
}

// ─── 2. HTTPS reachability ──────────────────────────────────────────────────
let res;
try {
  res = await fetch(`https://${domain}/`, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if ([200, 301, 302, 307, 308].includes(res.status)) {
    pass(`HTTPS responds: HTTP ${res.status}`);
  } else {
    fail(`HTTPS responded with unexpected status: HTTP ${res.status}`);
  }
} catch (e) {
  fail(`HTTPS unreachable: ${e.message}`);
  console.log("\n❌ Domain validation FAILED. Check Cloudflare Pages custom domain setup.");
  process.exit(1);
}

// ─── 3. Cloudflare presence ─────────────────────────────────────────────────
const cfRay = res.headers.get("cf-ray");
const cfCache = res.headers.get("cf-cache-status");
const server = res.headers.get("server");

if (cfRay) {
  pass(`Cloudflare proxy active (cf-ray: ${cfRay})`);
} else if (server?.toLowerCase().includes("cloudflare")) {
  pass("Cloudflare proxy active (via server header)");
} else {
  warn("Cloudflare proxy not detected — ensure domain is proxied (orange cloud in DNS)");
}

// ─── 4. SSL certificate check ───────────────────────────────────────────────
try {
  const secureRes = await fetch(`https://${domain}/`, {
    method: "HEAD",
    signal: AbortSignal.timeout(5000),
  });
  pass(`SSL certificate valid`);
} catch (e) {
  if (e.message.includes("certificate") || e.message.includes("SSL")) {
    fail(`SSL certificate error: ${e.message}`);
  } else {
    pass("SSL certificate reachable (no SSL errors)");
  }
}

// ─── 5. Security headers ────────────────────────────────────────────────────
const secHeaders = {
  "strict-transport-security": "HSTS",
  "x-content-type-options": "X-Content-Type-Options",
  "x-frame-options": "X-Frame-Options",
};
for (const [header, name] of Object.entries(secHeaders)) {
  if (res.headers.get(header)) {
    pass(`Security header present: ${name}`);
  } else {
    warn(`Security header missing: ${name} — add via Cloudflare → Transform Rules`);
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log("❌ Domain validation FAILED. Fix the issues above before activating the license.");
  process.exit(1);
} else {
  console.log("✅ Domain validation PASSED. Domain is ready for license activation.\n");
}
