#!/usr/bin/env node
/**
 * ============================================================================
 * AETHER AR — Build-Integrity Manifest Signer (Ed25519)
 * ============================================================================
 * Hashes every emitted JS bundle using SHA-384, builds a canonical manifest:
 *   {
 *     buildId,
 *     customerId,
 *     files: [ { path, hash } ],
 *     releaseHash
 *   }
 * Signs the payload with LICENCE_PRIVATE_KEY_JWK and POSTs to the admin server.
 *
 * Usage:
 *   BUILD_ID=client-v1.0.0 \
 *   CUSTOMER_ID=550e8400-e29b-41d4-a716-446655440000 \
 *   LICENCE_PRIVATE_KEY_JWK='{...}' \
 *   LICENCE_API_URL=https://admin.your-domain.com \
 *   RELEASE_MANIFEST_SECRET=your-shared-secret \
 *   node scripts/sign-manifest.mjs dist/client
 * ============================================================================
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { webcrypto as crypto } from "node:crypto";

async function main() {
  const root = process.argv[2] ?? "dist";
  const buildId = process.env.BUILD_ID;
  const customerId = process.env.CUSTOMER_ID || process.env.VITE_CUSTOMER_ID || "universal";
  const privateKeyJwk = process.env.LICENCE_PRIVATE_KEY_JWK;
  const licenceApiUrl = process.env.LICENCE_API_URL;
  const releaseSecret = process.env.RELEASE_MANIFEST_SECRET;

  if (!buildId) {
    console.error("❌ Error: BUILD_ID environment variable is required.");
    process.exit(1);
  }

  console.log("\n===================================================================");
  console.log("🔐 AETHER AR — BUILD INTEGRITY MANIFEST SIGNER");
  console.log("===================================================================\n");
  console.log(`📂 Scanning directory: ${root}`);
  console.log(`🆔 Build ID:          ${buildId}`);
  console.log(`👤 Customer ID:        ${customerId}\n`);

  async function walk(dir) {
    const out = [];
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        const s = await stat(full);
        if (s.isDirectory()) {
          out.push(...(await walk(full)));
        } else if (full.endsWith(".js") || full.endsWith(".mjs")) {
          out.push(full);
        }
      }
    } catch (e) {
      console.error(`⚠️ Directory walk error on ${dir}:`, e.message);
    }
    return out;
  }

  const hex = (buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const jsFiles = (await walk(root)).sort();
  if (jsFiles.length === 0) {
    console.error(`❌ Error: No JS bundles found under '${root}'. Run 'bun run build' first.`);
    process.exit(1);
  }

  // 1. Hash every bundle using SHA-384
  const fileEntries = [];
  for (const file of jsFiles) {
    const data = await readFile(file);
    const hash = hex(await crypto.subtle.digest("SHA-384", data));
    const relPath = "/" + relative(root, file).replace(/\\/g, "/");
    fileEntries.push({ path: relPath, hash });
  }

  // 2. Compute canonical releaseHash from sorted lines
  const manifestLines = fileEntries.map((f) => `${f.path}:${f.hash}`).join("\n");
  const releaseHash = hex(
    await crypto.subtle.digest("SHA-384", new TextEncoder().encode(manifestLines))
  );

  console.log(`📦 Processed ${fileEntries.length} JS bundle(s).`);
  console.log(`🔑 Canonical Release Hash (SHA-384): ${releaseHash}\n`);

  // 3. Ed25519 Signature over canonical string `${buildId}.${customerId}.${releaseHash}`
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
      const signMessage = new TextEncoder().encode(`${buildId}.${customerId}.${releaseHash}`);
      const sigBuf = await crypto.subtle.sign("Ed25519", key, signMessage);
      signature = Buffer.from(sigBuf).toString("base64url");
      console.log("✍️  Ed25519 signature generated successfully.");
    } catch (e) {
      console.error("❌ Failed to sign manifest:", e.message);
      process.exit(1);
    }
  } else {
    console.warn("⚠️ LICENCE_PRIVATE_KEY_JWK not provided — manifest will be unsigned.");
  }

  const manifestPayload = {
    buildId,
    customerId,
    releaseHash,
    signature,
    files: fileEntries,
    branch: "client-app",
    fileCount: fileEntries.length,
    timestamp: new Date().toISOString(),
  };

  console.log("\n--- MANIFEST OUTPUT ---");
  console.log(JSON.stringify(manifestPayload, null, 2));

  // 4. POST to admin server if configured
  if (licenceApiUrl && releaseSecret) {
    console.log(`\n🚀 Publishing manifest to: ${licenceApiUrl}/api/public/licence/manifest...`);
    const res = await fetch(
      `${licenceApiUrl.replace(/\/+$/, "")}/api/public/licence/manifest`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-release-secret": releaseSecret,
        },
        body: JSON.stringify({
          buildId,
          customerId,
          assetDigest: releaseHash,
          releaseHash,
          signature,
          files: fileEntries,
          branch: "client-app",
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Manifest publish failed [${res.status}]: ${errText}`);
      process.exit(1);
    }
    console.log("✅ Manifest successfully registered on admin server!");
  } else {
    console.log("\n💡 To automatically publish this manifest to your admin server, set:");
    console.log("   LICENCE_API_URL and RELEASE_MANIFEST_SECRET");
  }
}

main().catch((err) => {
  console.error("💥 Manifest signing error:", err);
  process.exit(1);
});
