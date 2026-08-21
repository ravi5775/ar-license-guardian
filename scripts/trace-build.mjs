#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — Forensic Build & Asset Tracer
 * ============================================================================
 * Scans suspect files (JS bundle, CSS, HTML, or .mind file) to extract
 * hidden customer provenance marks and identify the source of leaked code.
 *
 * Checks:
 *   1. CSS custom property: `--aether-cid`
 *   2. HTML meta tag: `<meta name="x-aether-build">`
 *   3. Invisible Unicode variation selectors (U+FE00-U+FE0F) in HTML/JS
 *   4. Benign JS constant signatures (`_AETH_SIG`, `window.__aether`)
 *   5. Binary `.mind` watermark chunk (magic "AETH")
 *
 * Usage:
 *   node scripts/trace-build.mjs path/to/suspect-file-or-dir
 * ============================================================================
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractMindWatermark } from "../src/lib/server-asset-watermark.ts";

function decodeInvisible(text) {
  try {
    const nibbles = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.codePointAt(i);
      if (code >= 0xfe00 && code <= 0xfe0f) {
        nibbles.push((code - 0xfe00).toString(16));
      }
    }
    if (nibbles.length >= 8) {
      return nibbles.join("");
    }
  } catch {}
  return null;
}

function scanFile(filePath) {
  const results = [];
  try {
    const buf = readFileSync(filePath);

    // 1. Check for .mind binary watermark
    if (filePath.endsWith(".mind")) {
      const mindMeta = extractMindWatermark(buf);
      if (mindMeta) {
        results.push({
          type: "MIND_BINARY_HEADER",
          customerId: mindMeta.customerId,
          details: mindMeta,
        });
      }
    }

    const text = buf.toString("utf-8");

    // 2. CSS variable check
    const cssMatch = text.match(/--aether-cid\s*:\s*["']?([a-f0-9-]+)["']?/i);
    if (cssMatch) {
      results.push({ type: "CSS_VARIABLE", customerId: cssMatch[1] });
    }

    // 3. Meta tag check
    const metaMatch = text.match(/<meta[^>]*name=["']x-aether-build["'][^>]*content=["']([^"']+)["']/i);
    if (metaMatch) {
      const raw = metaMatch[1];
      const parts = raw.split("\u200b");
      const buildId = parts[0];
      const decodedHex = decodeInvisible(parts[1] || "");
      results.push({ type: "HTML_META_TAG", buildId, decodedHex });
    }

    // 4. JS constant / window property check
    const jsMatch = text.match(/__aether\s*=\s*\{[^}]*c:\s*["']([a-f0-9-]+)["']/i);
    if (jsMatch) {
      results.push({ type: "WINDOW_GLOBAL_PROPERTY", customerId: jsMatch[1] });
    }

    // 5. Raw zero-width characters in JS/HTML
    const unicodeDecoded = decodeInvisible(text);
    if (unicodeDecoded) {
      results.push({ type: "UNICODE_VARIATION_SELECTOR", rawHex: unicodeDecoded });
    }

    // 6. Explicit customer ID UUID regex match
    const uuidMatches = text.matchAll(/VITE_CUSTOMER_ID["']?\s*:\s*["']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/gi);
    for (const m of uuidMatches) {
      results.push({ type: "VITE_INLINE_CONSTANT", customerId: m[1] });
    }
  } catch (e) {
    // Ignore read errors
  }
  return results;
}

function scanDir(dir) {
  const allFindings = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory() && entry !== "node_modules" && entry !== ".git") {
      allFindings.push(...scanDir(full));
    } else if (s.isFile()) {
      const hits = scanFile(full);
      for (const h of hits) {
        allFindings.push({ file: full, ...h });
      }
    }
  }
  return allFindings;
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/trace-build.mjs <file_or_directory_path>");
    process.exit(1);
  }

  console.log("\n===================================================================");
  console.log("🕵️  AETHER AR — FORENSIC PROVENANCE TRACER");
  console.log("===================================================================\n");
  console.log(`🎯 Target Path: ${target}\n`);

  const stat = statSync(target);
  const findings = stat.isDirectory() ? scanDir(target) : scanFile(target).map((f) => ({ file: target, ...f }));

  if (findings.length === 0) {
    console.log("⚠️ No embedded customer watermarks detected in target.");
    console.log("   Note: If the reseller ran a full code stripper/re-formatter,");
    console.log("   check the binary .mind assets or query the domain check-in log.");
    console.log("\n===================================================================\n");
    return;
  }

  console.log(`🔍 Found ${findings.length} watermark trace(s):\n`);
  for (const f of findings) {
    console.log(`📍 File: ${f.file}`);
    console.log(`   Mechanism:   ${f.type}`);
    if (f.customerId) console.log(`   Customer ID: ${f.customerId}`);
    if (f.buildId) console.log(`   Build ID:    ${f.buildId}`);
    if (f.decodedHex) console.log(`   Decoded Hex: ${f.decodedHex}`);
    if (f.details) console.log(`   Meta:        ${JSON.stringify(f.details)}`);
    console.log("");
  }

  console.log("===================================================================");
  console.log("✅ Forensic Trace Completed.");
  console.log("===================================================================\n");
}

main();
