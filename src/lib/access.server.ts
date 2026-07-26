/**
 * Server-only crypto helpers for restricted (PIN-protected) AR content.
 *
 * Three distinct secrets, three distinct jobs — never interchange them:
 *  - PIN_ENCRYPTION_KEY   → AES-GCM key, reversible, lets the server show the
 *                           admin the PIN again and re-derive QR tokens.
 *  - QR_TOKEN_SECRET      → HMAC key for the `tok` param baked into printed QRs.
 *  - ACCESS_SESSION_SECRET→ HMAC key for the 48h post-PIN session cookie.
 *
 * The bcrypt hash of the PIN lives in Postgres (pgcrypto `crypt`) and is the
 * only thing manual PIN entry is ever checked against.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(input: string) {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sha256Key(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return new Uint8Array(digest);
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server secret: ${name}`);
  return v;
}

/* ------------------------------------------------------------------ */
/* Reversible PIN storage (AES-GCM)                                    */
/* ------------------------------------------------------------------ */

async function aesKey() {
  const raw = await sha256Key(requireEnv("PIN_ENCRYPTION_KEY"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptPin(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)),
  );
  return `${b64url(iv)}.${b64url(ct)}`;
}

export async function decryptPin(stored: string | null): Promise<string | null> {
  if (!stored || !stored.includes(".")) return null;
  try {
    const [ivPart, ctPart] = stored.split(".");
    const key = await aesKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64url(ivPart) },
      key,
      fromB64url(ctPart),
    );
    return dec.decode(pt);
  } catch {
    return null;
  }
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

/**
 * Signed token embedded in the printed QR: HMAC-SHA256(slug + ":" + pin).
 * Not reversible — only re-derivable from the decrypted PIN, which is exactly
 * why `pin_encrypted` exists. Regenerating the PIN invalidates every old QR.
 */
export function deriveQrToken(slug: string, pin: string) {
  return hmac(requireEnv("QR_TOKEN_SECRET"), `${slug}:${pin}`);
}

export async function verifyQrToken(slug: string, pin: string, tok: string) {
  return safeEqual(await deriveQrToken(slug, pin), tok);
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
/* Slug + PIN generation                                               */
/* ------------------------------------------------------------------ */

const SLUG_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Mixed-case letters AND digits — never digits-only (guaranteed below). */
const PIN_LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const PIN_DIGITS = "23456789";

function pick(alphabet: string, n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** 12-16 char mixed-case alphanumeric public path segment. */
export function generateRestrictedSlug() {
  const len = 12 + (crypto.getRandomValues(new Uint8Array(1))[0] % 5);
  return pick(SLUG_ALPHABET, len);
}

/** 4-char alphanumeric PIN with at least one letter and one digit. */
export function generatePin() {
  const chars = [
    pick(PIN_LETTERS, 1),
    pick(PIN_DIGITS, 1),
    pick(PIN_LETTERS + PIN_DIGITS, 1),
    pick(PIN_LETTERS + PIN_DIGITS, 1),
  ];
  // Fisher-Yates with CSPRNG so the letter/digit aren't always in slot 0/1.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
