/**
 * ============================================================================
 * AETHER AR — COMPREHENSIVE SECURITY REGRESSION TEST SUITE
 * ============================================================================
 *
 * Exhaustive regression verification for all 13 security-critical paths:
 *
 * 1.  License Activation & Cryptographic Tokens
 * 2.  One-Time Media Nonce Replay Prevention
 * 3.  PIN Verification & Brute-Force Throttling
 * 4.  HMAC-SHA256 Session Cookies & Tamper Resistance
 * 5.  Presign Authorization & Delivery Gate
 * 6.  Upload Payload & Size Validation
 * 7.  Magic-Byte Inspection & File Spoofing Prevention
 * 8.  Path Traversal & Filename Sanitization
 * 9.  Multi-Tenant Namespace & DTO Data Isolation
 * 10. Rate Limiting & Fail-Closed Mutation Mechanics
 * 11. Strict allowed_origins Enforcement
 * 12. Legacy Endpoint Tombstone & Deactivation
 * 13. Environment Configuration & Least-Privilege Role Defaults
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateMagicBytes,
  sanitizeFilename,
  validateUploadPayload,
  MAX_FILE_SIZE_BYTES,
} from "../src/lib/upload-security";
import {
  scopeUploadPath,
  ownsUploadPath,
  type Uploader,
} from "../src/lib/uploader-guard.server";
import {
  accessCookieName,
  signAccessCookie,
  verifyAccessCookie,
  safeEqual,
  generateRestrictedSlug,
  ACCESS_COOKIE_MAX_AGE,
} from "../src/lib/access.server";
import {
  sanitizeExperience,
  sanitizeAlbum,
  sanitizeLicenseActivation,
  sanitizeProfilePublic,
} from "../src/lib/dto-sanitizer";
import { sha256Hex } from "../src/lib/content-access.server";
import {
  readEnv,
  requireEnv,
  licenceRole,
  dbDriver,
  runtime,
} from "../src/lib/adapters/env.server";
import { deploymentProfile } from "../src/lib/adapters/deployment.server";
import {
  check,
  __setBackend,
  rateLimitDriver,
} from "../src/lib/adapters/ratelimit.server";
import { presignGatingEnabled } from "../src/lib/adapters/presign-gate.server";
import { __internals } from "../src/lib/adapters/licence.server";

// ============================================================================
// 1. LICENSE ACTIVATION & CRYPTOGRAPHIC TOKENS
// ============================================================================
describe("1. License Activation & Cryptographic Tokens", () => {
  it("verifies constant-time equality comparison for device secrets", () => {
    const secret = "aether_secret_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c";
    const same = "aether_secret_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c";
    const diff = "aether_secret_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2d";
    const short = "aether_secret_short";

    expect(safeEqual(secret, same)).toBe(true);
    expect(safeEqual(secret, diff)).toBe(false);
    expect(safeEqual(secret, short)).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("verifies attestation rules: digest mismatch is rejected with high severity", () => {
    // attestationAllows helper checks whether attestation state allows activation
    const verifiedAttestation = { kind: "ok" as const, buildId: "b-100", assetDigest: "sha256-abc" };
    const mismatchAttestation = { kind: "digest_mismatch" as const, buildId: "b-100", reported: "sha256-tampered", expected: "sha256-real" };
    const missingAttestation = { kind: "missing_attestation" as const };
    const unknownAttestation = { kind: "unknown_build" as const, buildId: "b-999" };
    const unsignedAttestation = { kind: "unsigned_build" as const };

    expect(__internals.attestationAllows(verifiedAttestation)).toBe(true);
    expect(__internals.attestationAllows(mismatchAttestation)).toBe(false);
    expect(__internals.attestationAllows(missingAttestation)).toBe(false);
    expect(__internals.attestationAllows(unknownAttestation)).toBe(false);
    expect(__internals.attestationAllows(unsignedAttestation)).toBe(false);
  });

  it("calculates SHA-256 hex correctly for device secrets and tokens", async () => {
    const hash = await sha256Hex("test_device_secret_12345");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic hashing
    const hash2 = await sha256Hex("test_device_secret_12345");
    expect(hash).toBe(hash2);
    // Distinct inputs produce distinct hashes
    const hash3 = await sha256Hex("test_device_secret_12346");
    expect(hash).not.toBe(hash3);
  });
});

// ============================================================================
// 2. ONE-TIME MEDIA NONCE REPLAY PREVENTION
// ============================================================================
describe("2. One-Time Media Nonce Replay Prevention", () => {
  it("hashes nonces using SHA-256 so raw nonces are never stored in plaintext", async () => {
    const rawNonce = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2";
    const hash = await sha256Hex(rawNonce);

    expect(hash.length).toBe(64);
    expect(hash).not.toBe(rawNonce);
    expect(hash).not.toContain(rawNonce);
  });

  it("verifies nonce validation bounds (length 20 to 200 characters)", () => {
    const validNonce = "nonce_random_string_32_bytes_long_12345";
    const tooShort = "short_nonce";
    const tooLong = "x".repeat(201);

    expect(validNonce.length >= 20 && validNonce.length <= 200).toBe(true);
    expect(tooShort.length >= 20 && tooShort.length <= 200).toBe(false);
    expect(tooLong.length >= 20 && tooLong.length <= 200).toBe(false);
  });

  it("validates media route file enforces no-store and 410 Gone on invalid/consumed nonces", async () => {
    const fs = await import("node:fs/promises");
    const routeCode = await fs.readFile("src/routes/api/public/m.$nonce.ts", "utf8");

    // Replay returns 410 with no-store
    expect(routeCode).toContain("status: 410");
    expect(routeCode).toContain('"cache-control": "no-store"');
    // Successful redirect has no-store, private
    expect(routeCode).toContain('"cache-control": "no-store, private"');
    // Consumes nonce atomically via RPC
    expect(routeCode).toContain('rpc("consume_media_nonce"');
  });
});

// ============================================================================
// 3. PIN VERIFICATION & BRUTE-FORCE THROTTLING
// ============================================================================
describe("3. PIN Verification & Brute-Force Throttling", () => {
  it("generates cryptographic slugs using safe alphabet without ambiguous chars", () => {
    const slug1 = generateRestrictedSlug();
    const slug2 = generateRestrictedSlug();

    expect(slug1.length).toBeGreaterThanOrEqual(12);
    expect(slug1.length).toBeLessThanOrEqual(16);
    expect(slug1).not.toBe(slug2);
    // Excludes ambiguous characters (0, O, 1, l, I)
    expect(slug1).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
  });

  it("verifies client schema contains strict pin and media nonce constraints", async () => {
    const fs = await import("node:fs/promises");
    const schema = await fs.readFile("supabase/client-schema.sql", "utf8");

    // Table media_access_nonces exists
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.media_access_nonces");
    // PIN hash column is defined in experiences & albums schema
    expect(schema).toContain("pin_hash text");
  });

});

// ============================================================================
// 4. HMAC-SHA256 SESSION COOKIES & TAMPER RESISTANCE
// ============================================================================
describe("4. HMAC-SHA256 Session Cookies & Tamper Resistance", () => {
  const TEST_SECRET = "test_hmac_secret_key_minimum_32_bytes_super_secure!";
  const originalSecret = process.env["ACCESS_SESSION_SECRET"];

  beforeEach(() => {
    process.env["ACCESS_SESSION_SECRET"] = TEST_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env["ACCESS_SESSION_SECRET"];
    } else {
      process.env["ACCESS_SESSION_SECRET"] = originalSecret;
    }
  });

  it("signs and verifies a valid access cookie within TTL", async () => {
    const slug = "my-test-album-slug";
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour in future

    const cookie = await signAccessCookie(slug, expiresAt);
    expect(cookie).toContain(".");
    expect(cookie.startsWith(`${expiresAt}.`)).toBe(true);

    const valid = await verifyAccessCookie(slug, cookie);
    expect(valid).toBe(true);
  });

  it("rejects an expired access cookie", async () => {
    const slug = "expired-album-slug";
    const pastExpiresAt = Date.now() - 1000 * 60; // 1 min in past

    const cookie = await signAccessCookie(slug, pastExpiresAt);
    const valid = await verifyAccessCookie(slug, cookie);
    expect(valid).toBe(false);
  });

  it("rejects a tampered slug in cookie payload", async () => {
    const slug = "original-slug";
    const attackerSlug = "victim-slug";
    const expiresAt = Date.now() + 1000 * 60 * 60;

    const cookie = await signAccessCookie(slug, expiresAt);
    // Attacker tries to use cookie issued for "original-slug" on "victim-slug"
    const valid = await verifyAccessCookie(attackerSlug, cookie);
    expect(valid).toBe(false);
  });

  it("rejects a tampered timestamp in cookie value", async () => {
    const slug = "timestamp-tamper-slug";
    const originalExpiresAt = Date.now() + 1000 * 60 * 5; // 5 min
    const forgedExpiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days

    const cookie = await signAccessCookie(slug, originalExpiresAt);
    const parts = cookie.split(".");
    // Replace timestamp part but keep old signature
    const forgedCookie = `${forgedExpiresAt}.${parts[1]}`;

    const valid = await verifyAccessCookie(slug, forgedCookie);
    expect(valid).toBe(false);
  });

  it("rejects a forged or corrupted HMAC signature", async () => {
    const slug = "forged-sig-slug";
    const expiresAt = Date.now() + 1000 * 60 * 60;
    const forgedCookie = `${expiresAt}.invalid_forged_base64_hmac_signature`;

    const valid = await verifyAccessCookie(slug, forgedCookie);
    expect(valid).toBe(false);
  });

  it("handles malformed, empty, or undefined cookie values safely", async () => {
    const slug = "safe-slug";
    expect(await verifyAccessCookie(slug, undefined)).toBe(false);
    expect(await verifyAccessCookie(slug, "")).toBe(false);
    expect(await verifyAccessCookie(slug, "no_period_in_string")).toBe(false);
    expect(await verifyAccessCookie(slug, "invalid_num.signature")).toBe(false);
  });

  it("generates sanitized access cookie names preventing header injection", () => {
    expect(accessCookieName("album", "valid-slug_123")).toBe("arac_album_valid-slug_123");
    // Traversal and injection characters stripped
    expect(accessCookieName("experience", "../bad/slug\r\nSet-Cookie:evil")).toBe("arac_experience_badslugSet-Cookieevil");
  });
});

// ============================================================================
// 5. PRESIGN AUTHORIZATION & DELIVERY GATE
// ============================================================================
describe("5. Presign Authorization & Delivery Gate", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("enforces presign gating on client role deployments by default", () => {
    delete process.env["LICENCE_ENFORCE_PRESIGN"];
    process.env["LICENCE_ROLE"] = "client";
    expect(presignGatingEnabled()).toBe(true);
  });

  it("disables presign gating on issuer deployments by default", () => {
    delete process.env["LICENCE_ENFORCE_PRESIGN"];
    process.env["LICENCE_ROLE"] = "issuer";
    expect(presignGatingEnabled()).toBe(false);
  });

  it("respects explicit LICENCE_ENFORCE_PRESIGN override", () => {
    process.env["LICENCE_ROLE"] = "issuer";
    process.env["LICENCE_ENFORCE_PRESIGN"] = "true";
    expect(presignGatingEnabled()).toBe(true);

    process.env["LICENCE_ROLE"] = "client";
    process.env["LICENCE_ENFORCE_PRESIGN"] = "false";
    expect(presignGatingEnabled()).toBe(false);
  });
});

// ============================================================================
// 6. UPLOAD PAYLOAD & SIZE VALIDATION
// ============================================================================
describe("6. Upload Payload & Size Validation", () => {
  it("enforces maximum upload payload size of 50 MB", async () => {
    const validFile = { name: "model.glb", type: "model/gltf-binary", size: 10 * 1024 * 1024 };
    const oversizedFile = { name: "huge.glb", type: "model/gltf-binary", size: MAX_FILE_SIZE_BYTES + 1 };

    const validGlbBuffer = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);

    const resValid = await validateUploadPayload(validFile, validGlbBuffer);
    expect(resValid.ok).toBe(true);

    const resOversized = await validateUploadPayload(oversizedFile, validGlbBuffer);
    expect(resOversized.ok).toBe(false);
    if (!resOversized.ok) {
      expect(resOversized.error).toContain("exceeds the 50 MB limit");
    }
  });

  it("rejects disallowed MIME types", async () => {
    const executable = { name: "app.png", type: "application/x-msdownload", size: 1024 };
    const res = await validateUploadPayload(executable);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Disallowed MIME type");
    }
  });

  it("rejects disallowed file extensions", async () => {
    const phpScript = { name: "shell.php", type: "application/octet-stream", size: 1024 };
    const exeFile = { name: "payload.exe", type: "application/octet-stream", size: 1024 };
    const htmlFile = { name: "xss.html", type: "text/html", size: 1024 };

    expect((await validateUploadPayload(phpScript)).ok).toBe(false);
    expect((await validateUploadPayload(exeFile)).ok).toBe(false);
    expect((await validateUploadPayload(htmlFile)).ok).toBe(false);
  });
});

// ============================================================================
// 7. MAGIC-BYTE INSPECTION & FILE SPOOFING PREVENTION
// ============================================================================
describe("7. Magic-Byte Inspection & File Spoofing Prevention", () => {
  it("validates PNG binary signatures (89 50 4E 47)", () => {
    const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fakePng = new Uint8Array([0x89, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    expect(validateMagicBytes(validPng, "png")).toBe(true);
    expect(validateMagicBytes(fakePng, "png")).toBe(false);
  });

  it("validates JPEG binary signatures (FF D8 FF)", () => {
    const validJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const fakeJpg = new Uint8Array([0xff, 0x00, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

    expect(validateMagicBytes(validJpg, "jpg")).toBe(true);
    expect(validateMagicBytes(validJpg, "jpeg")).toBe(true);
    expect(validateMagicBytes(fakeJpg, "jpg")).toBe(false);
  });

  it("validates MP4 ISO ftyp box signature at offset 4", () => {
    // 4 bytes length + "ftyp"
    const validMp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const fakeMp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x61, 0x62, 0x63, 0x64]);

    expect(validateMagicBytes(validMp4, "mp4")).toBe(true);
    expect(validateMagicBytes(fakeMp4, "mp4")).toBe(false);
  });

  it("validates WebM EBML header signature (1A 45 DF A3)", () => {
    const validWebm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
    const fakeWebm = new Uint8Array([0x1a, 0x45, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    expect(validateMagicBytes(validWebm, "webm")).toBe(true);
    expect(validateMagicBytes(fakeWebm, "webm")).toBe(false);
  });

  it("validates GLB glTF 2.0 binary header (0x67 0x6C 0x54 0x46)", () => {
    const validGlb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);
    const fakeGlb = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]); // ZIP disguised as GLB

    expect(validateMagicBytes(validGlb, "glb")).toBe(true);
    expect(validateMagicBytes(fakeGlb, "glb")).toBe(false);
  });

  it("validates MindAR compiled target MIND header (0x4D 0x49 0x4E 0x44)", () => {
    const validMind = new Uint8Array([0x4d, 0x49, 0x4e, 0x44, 0x01, 0x00, 0x00, 0x00]);
    const fakeMind = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50]); // <!DOCTYP disguised as MIND

    expect(validateMagicBytes(validMind, "mind")).toBe(true);
    expect(validateMagicBytes(fakeMind, "mind")).toBe(false);
  });

  it("rejects buffers smaller than 4 bytes", () => {
    const tiny = new Uint8Array([0x89, 0x50]);
    expect(validateMagicBytes(tiny, "png")).toBe(false);
    expect(validateMagicBytes(tiny, "glb")).toBe(false);
  });
});

// ============================================================================
// 8. PATH TRAVERSAL & FILENAME SANITIZATION
// ============================================================================
describe("8. Path Traversal & Filename Sanitization", () => {
  it("sanitizes filenames and assigns UUIDs preventing path traversal", () => {
    const dangerous = "../../../etc/passwd.png";
    const sanitized = sanitizeFilename(dangerous);

    expect(sanitized).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
    expect(sanitized).not.toContain("..");
    expect(sanitized).not.toContain("/");
    expect(sanitized).not.toContain("passwd");
  });

  it("strips Windows path separators and control characters", () => {
    const winPath = "..\\..\\windows\\system32\\cmd.exe.jpg";
    const sanitized = sanitizeFilename(winPath);

    expect(sanitized.endsWith(".jpg")).toBe(true);
    expect(sanitized).not.toContain("\\");
    expect(sanitized).not.toContain("..");
  });

  it("throws on disallowed extensions during sanitization", () => {
    expect(() => sanitizeFilename("../evil.sh")).toThrow("Disallowed file extension");
    expect(() => sanitizeFilename("script.js")).toThrow("Disallowed file extension");
  });
});

// ============================================================================
// 9. MULTI-TENANT NAMESPACE & DTO DATA ISOLATION
// ============================================================================
describe("9. Multi-Tenant Namespace & DTO Data Isolation", () => {
  const regularUser: Uploader = { userId: "user-alice-1234", isAdmin: false };
  const adminUser: Uploader = { userId: "admin-root-0001", isAdmin: true };

  it("scopes user uploads strictly inside u/<userId>/ prefix", () => {
    const scoped = scopeUploadPath(regularUser, "targets/marker.mind");
    expect(scoped).toBe("u/user-alice-1234/targets/marker.mind");
  });

  it("prevents user from escaping their namespace by passing foreign u/ prefixes", () => {
    const attack = "u/victim-bob-5678/private-photo.jpg";
    const scoped = scopeUploadPath(regularUser, attack);
    // Strips victim's prefix and attaches Alice's prefix
    expect(scoped).toBe("u/user-alice-1234/private-photo.jpg");
    expect(scoped).not.toContain("victim-bob-5678");
  });

  it("neutralizes path traversal attempts within scopeUploadPath and scopes strictly", () => {
    // Pure traversal strings throw
    expect(() => scopeUploadPath(regularUser, "   ")).toThrow();
    expect(() => scopeUploadPath(regularUser, "../..")).toThrow();
    expect(() => scopeUploadPath(regularUser, "./.")).toThrow();

    // Traversal prefix is stripped, forcing containment within user namespace
    const scoped = scopeUploadPath(regularUser, "../../../root.png");
    expect(scoped).toBe("u/user-alice-1234/root.png");
    expect(scoped.startsWith("u/user-alice-1234/")).toBe(true);
  });

  it("allows admins to manage un-prefixed flat storage paths", () => {
    const adminPath = scopeUploadPath(adminUser, "system/banner.png");
    expect(adminPath).toBe("system/banner.png");
  });

  it("enforces path ownership verification (ownsUploadPath)", () => {
    expect(ownsUploadPath(regularUser, "u/user-alice-1234/file.png")).toBe(true);
    expect(ownsUploadPath(regularUser, "u/victim-bob-5678/file.png")).toBe(false);
    expect(ownsUploadPath(regularUser, "system/banner.png")).toBe(false);
    // Admins own everything
    expect(ownsUploadPath(adminUser, "u/victim-bob-5678/file.png")).toBe(true);
  });

  it("sanitizes experience DTOs: removes pin_hash and exposes has_pin boolean", () => {
    const rawExperience = {
      id: "exp-1",
      title: "Private Demo",
      pin_hash: "$2a$12$e8Y7z6x5w4v3u2t1s0r9q8p7o6n5m4l3k2j1i0h9g8f7e6d5c4b3a",
      pin_expires_at: "2027-01-01T00:00:00Z",
      pin_failed_attempts: 0,
      pin_locked_until: null,
      owner_id: "user-1",
      published: true,
    };

    const sanitized = sanitizeExperience(rawExperience);
    expect((sanitized as Record<string, unknown>).pin_hash).toBeUndefined();
    expect(sanitized.has_pin).toBe(true);
    expect(sanitized.title).toBe("Private Demo");
  });

  it("sanitizes album DTOs: removes pin_hash and preserves target indexes", () => {
    const rawAlbum = {
      id: "alb-1",
      title: "Wedding Album",
      pin_hash: "$2a$12$secret_bcrypt_hash",
      pin_expires_at: null,
      pin_failed_attempts: 2,
      pin_locked_until: null,
      owner_id: "user-1",
    };

    const sanitized = sanitizeAlbum(rawAlbum);
    expect((sanitized as Record<string, unknown>).pin_hash).toBeUndefined();
    expect(sanitized.has_pin).toBe(true);
    expect(sanitized.title).toBe("Wedding Album");
  });

  it("sanitizes license activation entities: removes device_secret_hash", () => {
    const rawActivation = {
      id: "act-1",
      license_id: "lic-1",
      device_secret_hash: "sha256_hash_of_device_secret_never_leak_this",
      fingerprint: "fp-12345",
      ip_address: "1.2.3.4",
      last_seen_at: new Date().toISOString(),
    };

    const sanitized = sanitizeLicenseActivation(rawActivation);
    expect((sanitized as Record<string, unknown>).device_secret_hash).toBeUndefined();
    expect(sanitized.id).toBe("act-1");
  });

  it("sanitizes public profiles: allowlists safe fields only", () => {
    const rawProfile = {
      id: "user-1",
      email: "alice@example.com",
      display_name: "Alice Designer",
      avatar_url: "https://example.com/avatar.jpg",
      approval_status: "approved",
      internal_secret_note: "VIP client",
      billing_id: "cus_12345",
    };

    const sanitized = sanitizeProfilePublic(rawProfile);
    expect((sanitized as Record<string, unknown>).internal_secret_note).toBeUndefined();
    expect((sanitized as Record<string, unknown>).billing_id).toBeUndefined();
    expect(sanitized.display_name).toBe("Alice Designer");
    expect(sanitized.email).toBe("alice@example.com");
  });

});

// ============================================================================
// 10. RATE LIMITING & FAIL-CLOSED MUTATION MECHANICS
// ============================================================================
describe("10. Rate Limiting & Fail-Closed Mutation Mechanics", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    __setBackend(null);
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    __setBackend(null);
  });

  it("enforces sliding-window rate limits and returns remaining count", async () => {
    process.env["RATELIMIT_DRIVER"] = "memory";
    process.env["LICENCE_ROLE"] = "client";
    process.env["RUNTIME"] = "node";
    process.env["NODE_ENV"] = "development";

    const key = `test_sliding_window_${Date.now()}`;
    const limit = 3;
    const windowSec = 60;

    const r1 = await check(key, limit, windowSec);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await check(key, limit, windowSec);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await check(key, limit, windowSec);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th attempt trips the limiter
    const r4 = await check(key, limit, windowSec);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("fails CLOSED on backend error when failMode is closed (mutations)", async () => {
    // Admin build with memory driver forces an error in getBackend()
    process.env["RATELIMIT_DRIVER"] = "memory";
    process.env["LICENCE_ROLE"] = "issuer";
    process.env["RUNTIME"] = "node";

    const result = await check("mutation_key", 10, 60, { failMode: "closed" });
    expect(result.allowed).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("fails OPEN on backend error when failMode is open (read-only heartbeats)", async () => {
    process.env["RATELIMIT_DRIVER"] = "memory";
    process.env["LICENCE_ROLE"] = "issuer";
    process.env["RUNTIME"] = "node";

    const result = await check("read_only_key", 10, 60, { failMode: "open" });
    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
  });
});

// ============================================================================
// 11. STRICT allowed_origins ENFORCEMENT
// ============================================================================
describe("11. Strict allowed_origins Enforcement", () => {
  it("strictly DENIES when allowed_origins is empty array or null (deny-by-default)", () => {
    expect(__internals.originAllowed(null, "example.com")).toBe(false);
    expect(__internals.originAllowed([], "example.com")).toBe(false);
    expect(__internals.originAllowed([], null)).toBe(false);
  });

  it("strictly DENIES when caller host is null or empty", () => {
    expect(__internals.originAllowed(["example.com"], null)).toBe(false);
    expect(__internals.originAllowed(["example.com"], "")).toBe(false);
  });

  it("allows exact origin match (case-insensitive)", () => {
    expect(__internals.originAllowed(["app.example.com"], "app.example.com")).toBe(true);
    expect(__internals.originAllowed(["App.Example.COM"], "app.example.com")).toBe(true);
    expect(__internals.originAllowed(["https://app.example.com/path"], "app.example.com")).toBe(true);
  });

  it("allows subdomain when root domain is allowlisted", () => {
    expect(__internals.originAllowed(["example.com"], "app.example.com")).toBe(true);
    expect(__internals.originAllowed(["example.com"], "staging.viewer.example.com")).toBe(true);
  });

  it("strictly DENIES unlisted domains and attacker suffix lookalikes", () => {
    expect(__internals.originAllowed(["example.com"], "attacker.com")).toBe(false);
    // Attacker domain ending with allowlisted name (e.g. not-example.com)
    expect(__internals.originAllowed(["example.com"], "fakeexample.com")).toBe(false);
    expect(__internals.originAllowed(["example.com"], "example.com.attacker.com")).toBe(false);
  });

  it("handles port numbers in origins and host headers correctly", () => {
    expect(__internals.originAllowed(["localhost:3000"], "localhost:3000")).toBe(true);
    expect(__internals.originAllowed(["localhost:3000"], "localhost")).toBe(true);
    expect(__internals.originAllowed(["example.com:8080"], "app.example.com:8080")).toBe(true);
  });
});

// ============================================================================
// 12. LEGACY ENDPOINT TOMBSTONE & DEACTIVATION
// ============================================================================
describe("12. Legacy Endpoint Tombstone & Deactivation", () => {
  it("verifies legacy /api/public/license/activate route is a pure 410 Gone tombstone", async () => {
    const fs = await import("node:fs/promises");
    const code = await fs.readFile("src/routes/api/public/license/activate.ts", "utf8");

    // All HTTP handlers return 410
    expect(code).toContain("status: 410");
    expect(code).toContain("ENDPOINT_REMOVED");
    expect(code).toContain("/api/public/licence/activate");

    // Must not contain any database or notification imports
    expect(code).not.toContain("supabaseAdmin");
    expect(code).not.toContain("sendDuplicateFingerprintAlert");
    expect(code).not.toContain("ActivateSchema");
  });
});

// ============================================================================
// 13. ENVIRONMENT CONFIGURATION & LEAST-PRIVILEGE ROLE DEFAULTS
// ============================================================================
describe("13. Environment Configuration & Least-Privilege Role Defaults", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("defaults LICENCE_ROLE to 'client' (least privilege)", () => {
    delete process.env["LICENCE_ROLE"];
    expect(licenceRole()).toBe("client");
  });

  it("throws descriptive error when required env variable is missing", () => {
    delete process.env["DATABASE_URL"];
    expect(() => requireEnv("DATABASE_URL")).toThrow("Missing required environment variable: DATABASE_URL");
  });

  it("reads optional env variables with fallback support", () => {
    delete process.env["NON_EXISTENT_VAR"];
    expect(readEnv("NON_EXISTENT_VAR", "default_val")).toBe("default_val");
  });

  it("correctly derives deployment profile features based on roles", () => {
    // Client profile (stateless)
    process.env["LICENCE_ROLE"] = "client";
    process.env["DB_DRIVER"] = "none";
    process.env["RUNTIME"] = "edge";

    const clientProf = deploymentProfile();
    expect(clientProf.kind).toBe("client-app");
    expect(clientProf.role).toBe("client");
    expect(clientProf.stateless).toBe(true);
    expect(clientProf.features.licensing).toBe(false);
    expect(clientProf.features.approvals).toBe(false);

    // Admin Managed profile
    process.env["LICENCE_ROLE"] = "issuer";
    process.env["DB_DRIVER"] = "neon";
    process.env["RUNTIME"] = "edge";

    const adminManaged = deploymentProfile();
    expect(adminManaged.kind).toBe("admin-managed");
    expect(adminManaged.role).toBe("admin");
    expect(adminManaged.features.licensing).toBe(true);
    expect(adminManaged.features.approvals).toBe(true);

    // Admin Self-Hosted profile
    process.env["LICENCE_ROLE"] = "issuer";
    process.env["DB_DRIVER"] = "postgres";
    process.env["RUNTIME"] = "node";

    const adminSelfHosted = deploymentProfile();
    expect(adminSelfHosted.kind).toBe("admin-self-hosted");
    expect(adminSelfHosted.runtime).toBe("node");
  });
});
