// Run: node scripts/generate-keypair.mjs
// Writes public.jwk (safe to commit into client apps) and private.jwk (KEEP SECRET).
import { subtle } from "node:crypto";
import { writeFileSync } from "node:fs";

const { publicKey, privateKey } = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const pub = await subtle.exportKey("jwk", publicKey);
const priv = await subtle.exportKey("jwk", privateKey);

writeFileSync("public.jwk", JSON.stringify(pub, null, 2));
writeFileSync("private.jwk", JSON.stringify(priv, null, 2));

console.log("Wrote public.jwk and private.jwk.");
console.log("→ Move private.jwk into your password manager and DELETE the file.");
console.log("→ Store public.jwk in your client apps (safe to commit).");
