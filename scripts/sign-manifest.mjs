#!/usr/bin/env node
/**
 * Build-integrity manifest signer. Run in CI after `vite build` on the
 * `client-app` branch, then POST the result to the admin server.
 *
 *   BUILD_ID=$GITHUB_SHA node scripts/sign-manifest.mjs dist/client
 *
 * Env:
 *   BUILD_ID                   release identifier (commit SHA)
 *   LICENCE_PRIVATE_KEY_JWK    Ed25519 private key (same key that signs tokens)
 *   LICENCE_API_URL            admin server base URL
 *   RELEASE_MANIFEST_SECRET    shared secret for /api/public/licence/manifest
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { webcrypto as crypto } from "node:crypto";

const root = process.argv[2] ?? "dist/client";
const buildId = process.env.BUILD_ID;
if (!buildId) {
  console.error("BUILD_ID is required");
  process.exit(1);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full)));
    else if (full.endsWith(".js")) out.push(full);
  }
  return out;
}

const hex = (buf) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const files = (await walk(root)).sort();
const lines = [];
for (const file of files) {
  const data = await readFile(file);
  lines.push(`/${relative(root, file)}:${hex(await crypto.subtle.digest("SHA-256", data))}`);
}
const assetDigest = hex(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(lines.join("\n"))),
);

let signature = "unsigned";
if (process.env.LICENCE_PRIVATE_KEY_JWK) {
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(process.env.LICENCE_PRIVATE_KEY_JWK),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(`${buildId}.${assetDigest}`),
  );
  signature = Buffer.from(sig).toString("base64url");
}

console.log(JSON.stringify({ buildId, assetDigest, signature, files: files.length }, null, 2));

if (process.env.LICENCE_API_URL && process.env.RELEASE_MANIFEST_SECRET) {
  const res = await fetch(
    `${process.env.LICENCE_API_URL.replace(/\/+$/, "")}/api/public/licence/manifest`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-release-secret": process.env.RELEASE_MANIFEST_SECRET,
      },
      body: JSON.stringify({ buildId, assetDigest, signature, branch: "client-app" }),
    },
  );
  if (!res.ok) {
    console.error(`manifest publish failed [${res.status}]: ${await res.text()}`);
    process.exit(1);
  }
  console.log("manifest published");
}
