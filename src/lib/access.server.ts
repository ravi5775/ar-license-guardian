/**
 * Server-only crypto helpers for restricted (PIN-protected) AR content.
 *
 * Two secrets, two jobs — never interchange them:
 *  - QR_TOKEN_SECRET       → reserved for legacy printed QR codes (unused by
 *                            new links; see content_access_tokens instead).
 *  - ACCESS_SESSION_SECRET → HMAC key for the 48h post-PIN session cookie.
 *
 * PINs themselves are NEVER stored reversibly. Postgres holds only a bcrypt
 * hash (pgcrypto `crypt`, cost 12) and is the only thing manual PIN entry is
 * ever checked against. QR auto-unlock uses a completely separate credential
 * (`content_access_tokens`), so rotating one does not affect the other.
 */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server secret: ${name}`);
  return v;
}

/* ------------------------------------------------------------------ */
/* HMAC helpers                                                        */
/* ------------------------------------------------------------------ */

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* 48h post-PIN session cookie                                         */
/* ------------------------------------------------------------------ */

export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 48;

export function accessCookieName(kind: "album" | "experience", slug: string) {
  return `arac_${kind}_${slug.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export async function signAccessCookie(slug: string, expiresAt: number) {
  const payload = `${slug}.${expiresAt}`;
  return `${expiresAt}.${await hmac(requireEnv("ACCESS_SESSION_SECRET"), payload)}`;
}

export async function verifyAccessCookie(slug: string, value: string | undefined) {
  if (!value || !value.includes(".")) return false;
  const idx = value.indexOf(".");
  const expiresAt = Number(value.slice(0, idx));
  const sig = value.slice(idx + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await hmac(
    requireEnv("ACCESS_SESSION_SECRET"),
    `${slug}.${expiresAt}`,
  );
  return safeEqual(expected, sig);
}

/* ------------------------------------------------------------------ */
/* Slug generation                                                     */
/* ------------------------------------------------------------------ */

const SLUG_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function pick(alphabet: string, n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** 12-16 char mixed-case alphanumeric public path segment. */
export function generateRestrictedSlug() {
  const len = 12 + (crypto.getRandomValues(new Uint8Array(1))[0] % 5);
  return pick(SLUG_ALPHABET, len);
}
