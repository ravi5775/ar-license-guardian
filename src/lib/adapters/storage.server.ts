/**
 * Storage adapter — S3-compatible (Cloudflare R2) with a hand-rolled SigV4
 * signer built on Web Crypto, so the exact same code runs on Workers and Node
 * with no SDK and no native modules.
 *
 * Ownership model A (recommended for resale protection): each customer supplies
 * their OWN R2 account in their own deployment env. We never hold their media.
 * Model B (your bucket): issue one scoped token per client restricted to
 * bucket=media, prefix=clients/{clientId}/ — never the account-level key.
 *
 * The customer's R2 secret NEVER reaches the browser: the browser asks their
 * server route for a presigned PUT and uploads directly to R2.
 */
import { readEnv, requireEnv } from "./env.server";

const enc = new TextEncoder();

export interface StorageConfig {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional prefix isolation for model B (your bucket, scoped per client). */
  prefix?: string;
  /** Public CDN base (Cloudflare in front of R2) for cacheable GETs. */
  publicBaseUrl?: string;
}

export function storageConfig(): StorageConfig {
  return {
    accountId: requireEnv("R2_ACCOUNT_ID"),
    bucket: requireEnv("R2_BUCKET"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET"),
    prefix: readEnv("R2_PREFIX") ?? undefined,
    publicBaseUrl: readEnv("R2_PUBLIC_BASE_URL") ?? undefined,
  };
}

function endpoint(cfg: StorageConfig) {
  return `https://${cfg.accountId}.r2.cloudflarestorage.com`;
}

function scopedKey(cfg: StorageConfig, key: string) {
  const clean = key.replace(/^\/+/, "");
  return cfg.prefix ? `${cfg.prefix.replace(/\/+$/, "")}/${clean}` : clean;
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(data)));
}

function uriEncode(value: string, encodeSlash = true) {
  return value
    .split("")
    .map((c) => {
      if (/[A-Za-z0-9_.~-]/.test(c)) return c;
      if (c === "/") return encodeSlash ? "%2F" : "/";
      return "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
    })
    .join("");
}

/**
 * Presign a request (GET or PUT) with SigV4 query auth.
 * Returns a URL the browser can use directly for `expiresIn` seconds.
 */
export async function presign(
  method: "GET" | "PUT",
  key: string,
  expiresIn = 900,
  cfg: StorageConfig = storageConfig(),
): Promise<string> {
  const host = new URL(endpoint(cfg)).host;
  const path = `/${cfg.bucket}/${uriEncode(scopedKey(cfg, key), false)}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;

  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${cfg.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = params
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join(
    "\n",
  );

  let signingKey = await hmac(enc.encode(`AWS4${cfg.secretAccessKey}`), dateStamp);
  signingKey = await hmac(signingKey, "auto");
  signingKey = await hmac(signingKey, "s3");
  signingKey = await hmac(signingKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));

  return `${endpoint(cfg)}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function put(
  key: string,
  body: ArrayBuffer | Uint8Array | string,
  contentType = "application/octet-stream",
  cfg: StorageConfig = storageConfig(),
): Promise<void> {
  const url = await presign("PUT", key, 300, cfg);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`storage.put failed [${res.status}]: ${await res.text()}`);
}

export async function get(key: string, cfg: StorageConfig = storageConfig()): Promise<ArrayBuffer> {
  const url = await presign("GET", key, 300, cfg);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`storage.get failed [${res.status}]: ${await res.text()}`);
  return res.arrayBuffer();
}

/** Cacheable public URL when the bucket sits behind Cloudflare; else presigned. */
export async function publicOrSignedUrl(
  key: string,
  expiresIn = 900,
  cfg: StorageConfig = storageConfig(),
): Promise<string> {
  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl.replace(/\/+$/, "")}/${scopedKey(cfg, key)}`;
  }
  return presign("GET", key, expiresIn, cfg);
}
