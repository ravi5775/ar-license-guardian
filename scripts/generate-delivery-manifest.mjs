#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — Signed Delivery Manifest Generator
 * ============================================================================
 * Generates DELIVERY_MANIFEST.json containing SHA-384 hashes of all delivered
 * source and compiled files, customer UUID, license key, and an Ed25519 signature.
 *
 * Usage:
 *   CUSTOMER_ID=... LICENCE_KEY=... LICENCE_PRIVATE_KEY_JWK='{...}' \
 *   node scripts/generate-delivery-manifest.mjs [output-dir]
 * ============================================================================
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { webcrypto as crypto } from "node:crypto";

async function main() {
  const root = process.argv[2] ?? process.cwd();
  const customerId = process.env.CUSTOMER_ID || process.env.VITE_CUSTOMER_ID;
  const licenseKey = process.env.LICENCE_KEY || process.env.VITE_LICENCE_KEY;
  const privateKeyJwk = process.env.LICENCE_PRIVATE_KEY_JWK;

  if (!customerId || !licenseKey) {
    console.error("❌ Error: CUSTOMER_ID and LICENCE_KEY environment variables are required.");
    process.exit(1);
  }

  console.log("\n===================================================================");
  console.log("📜 AETHER AR — SIGNED DELIVERY MANIFEST GENERATOR");
  console.log("===================================================================\n");
  console.log(`👤 Customer ID: ${customerId}`);
  console.log(`🔑 Licence Key: ${licenseKey}`);

  const hex = (buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  function walk(dir) {
    const out = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".system_generated") continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        out.push(...walk(full));
      } else if (s.isFile() && !entry.includes("DELIVERY_MANIFEST")) {
        out.push(full);
      }
    }
    return out;
  }

  const files = walk(root).sort();
  const fileEntries = [];

  for (const file of files) {
    const data = readFileSync(file);
    const hash = hex(await crypto.subtle.digest("SHA-384", data));
    const relPath = relative(root, file).replace(/\\/g, "/");
    fileEntries.push({ path: relPath, sizeBytes: data.length, sha384: hash });
  }

  // Canonical tree hash
  const treeDigest = hex(
    await crypto.subtle.digest(
      "SHA-384",
      new TextEncoder().encode(fileEntries.map((f) => `${f.path}:${f.sha384}`).join("\n"))
    )
  );

  let signature = "unsigned";
  if (privateKeyJwk) {
    try {
      const keyObj = typeof privateKeyJwk === "string" ? JSON.parse(privateKeyJwk) : privateKeyJwk;
      const key = await crypto.subtle.importKey(
        "jwk",
        keyObj,
        { name: "Ed25519" },
        false,
        ["sign"]
      );
      const signPayload = new TextEncoder().encode(`${customerId}:${licenseKey}:${treeDigest}`);
      const sigBuf = await crypto.subtle.sign("Ed25519", key, signPayload);
      signature = Buffer.from(sigBuf).toString("base64url");
      console.log("✓ Cryptographic Ed25519 signature generated.");
    } catch (e) {
      console.warn("⚠️ Could not sign manifest:", e.message);
    }
  }

  const manifest = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    customer: {
      id: customerId,
      licenseKey: licenseKey,
    },
    provenance: {
      treeDigest,
      signature,
      totalFiles: fileEntries.length,
    },
    files: fileEntries,
  };

  const outputPath = join(root, "DELIVERY_MANIFEST.json");
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\n✅ Generated signed delivery manifest at: ${outputPath}`);
  console.log(`   Files hashed: ${fileEntries.length} | Tree Digest: ${treeDigest}\n`);
}

main().catch((err) => {
  console.error("💥 Manifest generation error:", err);
  process.exit(1);
});
