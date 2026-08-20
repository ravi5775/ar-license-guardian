#!/usr/bin/env node
/** Generate the Ed25519 licence signing keypair. Run once, store securely. */
import { webcrypto as crypto } from "node:crypto";

const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);

console.log("LICENCE_PRIVATE_KEY_JWK (admin branches only, secret):");
console.log(JSON.stringify(priv));
console.log("\nVITE_LICENCE_PUBLIC_KEY (baked into client-app bundle, public):");
console.log(JSON.stringify(pub));
