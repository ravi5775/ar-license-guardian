import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mutable headers and cookies for simulating requests
let mockHeaders: Record<string, string> = {};
let mockCookies: Record<string, string> = {};

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => mockHeaders[name.toLowerCase()] ?? null,
  getCookie: (name: string) => mockCookies[name] ?? null,
}));

// Mutable mock Supabase admin query responses
let mockLicenseData: any = null;
let mockDeviceData: any = null;
let mockManifestData: any = null;
let recordedViolations: Array<{ kind: string; detail: any; target: any }> = [];

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: any) => ({
          maybeSingle: async () => {
            if (table === "licenses") return { data: mockLicenseData, error: null };
            if (table === "license_activations") return { data: mockDeviceData, error: null };
            if (table === "release_manifests") return { data: mockManifestData, error: null };
            return { data: null, error: null };
          },
        }),
      }),
      insert: async (row: any) => {
        if (table === "license_violations") {
          recordedViolations.push({
            kind: row.kind,
            detail: row.details,
            target: { licenseId: row.license_id, licenceKey: row.details?.licenceKey },
          });
        }
        return { data: null, error: null };
      },
    }),
  },
}));

vi.mock("../src/lib/adapters/licence.server", () => ({
  recordViolation: async (kind: string, detail: any, target: any) => {
    recordedViolations.push({ kind, detail, target });
  },
}));

import {
  presignGatingEnabled,
  checkPresignLicence,
  LICENCE_COOKIE,
  LICENCE_HEADER,
} from "../src/lib/adapters/presign-gate.server";

// Helper: generate Ed25519 keypair and mint signed test tokens
async function createTestKeyPair() {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return { keyPair, publicJwk, privateJwk };
}

function bytesToB64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToB64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signPayload(payload: Record<string, any>, privateKey: CryptoKey): Promise<string> {
  const header = { alg: "Ed25519", typ: "JWT" };
  const headerB64 = strToB64Url(JSON.stringify(header));
  const payloadB64 = strToB64Url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign("Ed25519", privateKey, data);
  const sigB64 = bytesToB64Url(new Uint8Array(sig));
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

describe("Security Audit & Test Suite: presign-gate.server.ts", () => {
  const origEnv = { ...process.env };
  let testKeys: { keyPair: CryptoKeyPair; publicJwk: JsonWebKey; privateJwk: JsonWebKey };

  beforeEach(async () => {
    mockHeaders = {};
    mockCookies = {};
    mockLicenseData = null;
    mockDeviceData = null;
    mockManifestData = null;
    recordedViolations = [];
    testKeys = await createTestKeyPair();
    process.env.LICENCE_PUBLIC_KEY_JWK = JSON.stringify(testKeys.publicJwk);
    delete process.env.LICENCE_PRIVATE_KEY_JWK;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  // =========================================================================
  // 1. presignGatingEnabled() Logic & Env Combinations
  // =========================================================================
  describe("1. Gating Activation (presignGatingEnabled)", () => {
    it("enables gating when LICENCE_ENFORCE_PRESIGN is 'true' or '1'", () => {
      process.env.LICENCE_ENFORCE_PRESIGN = "true";
      expect(presignGatingEnabled()).toBe(true);

      process.env.LICENCE_ENFORCE_PRESIGN = "1";
      expect(presignGatingEnabled()).toBe(true);

      process.env.LICENCE_ENFORCE_PRESIGN = " TRUE ";
      expect(presignGatingEnabled()).toBe(true);
    });

    it("disables gating when LICENCE_ENFORCE_PRESIGN is 'false' or '0'", () => {
      process.env.LICENCE_ENFORCE_PRESIGN = "false";
      expect(presignGatingEnabled()).toBe(false);

      process.env.LICENCE_ENFORCE_PRESIGN = "0";
      expect(presignGatingEnabled()).toBe(false);
    });

    it("defaults to ON for customer client deployments (LICENCE_ROLE=client)", () => {
      delete process.env.LICENCE_ENFORCE_PRESIGN;
      process.env.LICENCE_ROLE = "client";
      expect(presignGatingEnabled()).toBe(true);
    });

    it("defaults to OFF for issuer/admin deployments (LICENCE_ROLE=issuer)", () => {
      delete process.env.LICENCE_ENFORCE_PRESIGN;
      process.env.LICENCE_ROLE = "issuer";
      expect(presignGatingEnabled()).toBe(false);
    });
  });

  // =========================================================================
  // 2. Public JWK Extraction & Derivation
  // =========================================================================
  describe("2. Cryptographic Key Resolution", () => {
    it("handles invalid JSON in LICENCE_PUBLIC_KEY_JWK gracefully", async () => {
      process.env.LICENCE_ENFORCE_PRESIGN = "true";
      process.env.LICENCE_PUBLIC_KEY_JWK = "{invalid-json";
      mockHeaders[LICENCE_HEADER] = "some.token.value";

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_INVALID");
    });

    it("derives public JWK from LICENCE_PRIVATE_KEY_JWK if public key is absent", async () => {
      process.env.LICENCE_ENFORCE_PRESIGN = "true";
      delete process.env.LICENCE_PUBLIC_KEY_JWK;
      process.env.LICENCE_PRIVATE_KEY_JWK = JSON.stringify(testKeys.privateJwk);

      const token = await signPayload(
        { sub: "LIC-123", did: "DEV-1", exp: Math.floor(Date.now() / 1000) + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;

      mockLicenseData = { id: "lic-uuid", license_key: "LIC-123", status: "active" };
      mockDeviceData = {
        id: "DEV-1",
        license_id: "lic-uuid",
        build_id: "b-1",
        asset_digest: "sha256-abc",
      };
      mockManifestData = { asset_digest: "sha256-abc", signature: "sig-valid" };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(true);
    });

    it("fails closed when neither public nor private key is available", async () => {
      process.env.LICENCE_ENFORCE_PRESIGN = "true";
      delete process.env.LICENCE_PUBLIC_KEY_JWK;
      delete process.env.LICENCE_PRIVATE_KEY_JWK;
      mockHeaders[LICENCE_HEADER] = "any.token.value";

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_INVALID");
    });
  });

  // =========================================================================
  // 3. checkPresignLicence() Security Decisions
  // =========================================================================
  describe("3. Presign Gate Authorization & Verification", () => {
    beforeEach(() => {
      process.env.LICENCE_ENFORCE_PRESIGN = "true";
    });

    it("allows unauthenticated bypass when gating is disabled", async () => {
      process.env.LICENCE_ENFORCE_PRESIGN = "false";
      const res = await checkPresignLicence("upload");
      expect(res).toEqual({ ok: true, enforced: false });
    });

    it("denies when licence token is missing (no header and no cookie)", async () => {
      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_MISSING");
    });

    it("accepts token from cookie when header is absent", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-1", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockCookies[LICENCE_COOKIE] = token;

      mockLicenseData = { id: "lic-uuid", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-1",
        license_id: "lic-uuid",
        build_id: "b-1",
        asset_digest: "sha256-abc",
      };
      mockManifestData = { asset_digest: "sha256-abc", signature: "sig-valid" };

      const res = await checkPresignLicence("media_fetch");
      expect(res.ok).toBe(true);
      expect(res.enforced).toBe(true);
    });

    it("strips 'Bearer ' prefix correctly from Authorization/Licence header", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-1", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = `Bearer ${token}`;

      mockLicenseData = { id: "lic-uuid", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-1",
        license_id: "lic-uuid",
        build_id: "b-1",
        asset_digest: "sha256-abc",
      };
      mockManifestData = { asset_digest: "sha256-abc", signature: "sig-valid" };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(true);
    });

    it("denies and records violation on cryptographically forged/tampered token", async () => {
      const otherKeys = await createTestKeyPair();
      const forgedToken = await signPayload(
        { sub: "LIC-FORGED", exp: Math.floor(Date.now() / 1000) + 3600 },
        otherKeys.keyPair.privateKey, // Signed with different key
      );
      mockHeaders[LICENCE_HEADER] = forgedToken;

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_INVALID");
      expect(recordedViolations.some((v) => v.kind === "presign_bad_token")).toBe(true);
    });

    it("denies when token is expired", async () => {
      const past = Math.floor(Date.now() / 1000) - 60; // Expired 1 minute ago
      const expiredToken = await signPayload(
        { sub: "LIC-EXP", exp: past },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = expiredToken;

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_EXPIRED_TOKEN");
    });

    it("denies and records violation when licence is not found in database", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-UNKNOWN", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = null; // Not found

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("INVALID_LICENCE");
      expect(recordedViolations.some((v) => v.kind === "presign_unknown_licence")).toBe(true);
    });

    it("denies when licence status is suspended or revoked", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-SUSPENDED", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid", license_key: "LIC-SUSPENDED", status: "suspended" };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_SUSPENDED");
    });

    it("denies when licence expires_at is in the past", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-PAST", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = {
        id: "lic-uuid",
        license_key: "LIC-PAST",
        status: "active",
        expires_at: new Date(Date.now() - 10000).toISOString(),
      };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("LICENCE_EXPIRED");
    });

    it("denies and records violation when token is missing did (device ID)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-NODID", exp: now + 3600 }, // No did
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid", license_key: "LIC-NODID", status: "active" };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("DEVICE_UNKNOWN");
      expect(recordedViolations.some((v) => v.kind === "presign_no_device")).toBe(true);
    });

    it("denies and records violation when device does not match licence_id (tenant mismatch)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-WRONG", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid-1", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-WRONG",
        license_id: "lic-uuid-2", // Belongs to a different licence/tenant
        build_id: "b-1",
        asset_digest: "sha256-abc",
      };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("DEVICE_UNKNOWN");
      expect(recordedViolations.some((v) => v.kind === "presign_no_device")).toBe(true);
    });

    it("denies when device slot was revoked / released", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-REVOKED", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-REVOKED",
        license_id: "lic-uuid",
        revoked_at: new Date().toISOString(),
      };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("DEVICE_RELEASED");
    });

    it("denies when build attestation is missing on device row", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-1", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-1",
        license_id: "lic-uuid",
        build_id: null,
        asset_digest: null,
      };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("ATTESTATION_INVALID");
      expect(recordedViolations.some((v) => v.kind === "presign_missing_attestation")).toBe(true);
    });

    it("denies when release manifest is unsigned or absent", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-1", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-1",
        license_id: "lic-uuid",
        build_id: "b-unsigned",
        asset_digest: "sha256-abc",
      };
      mockManifestData = { asset_digest: "sha256-abc", signature: "unsigned" };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("ATTESTATION_INVALID");
      expect(recordedViolations.some((v) => v.kind === "presign_unsigned_build")).toBe(true);
    });

    it("denies when release manifest digest does not match reported digest (tampered build)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-100", did: "DEV-1", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-uuid", license_key: "LIC-100", status: "active" };
      mockDeviceData = {
        id: "DEV-1",
        license_id: "lic-uuid",
        build_id: "b-tampered",
        asset_digest: "sha256-reported-digest",
      };
      mockManifestData = { asset_digest: "sha256-real-digest", signature: "sig-valid" };

      const res = await checkPresignLicence("upload");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("ATTESTATION_INVALID");
      expect(recordedViolations.some((v) => v.kind === "digest_mismatch")).toBe(true);
    });

    it("succeeds when all licence, device, and attestation checks pass", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signPayload(
        { sub: "LIC-PRO-1", did: "DEV-PRO-1", exp: now + 3600 },
        testKeys.keyPair.privateKey,
      );
      mockHeaders[LICENCE_HEADER] = token;
      mockLicenseData = { id: "lic-1", license_key: "LIC-PRO-1", status: "active" };
      mockDeviceData = {
        id: "DEV-PRO-1",
        license_id: "lic-1",
        build_id: "build-v1",
        asset_digest: "sha256-matching-digest",
      };
      mockManifestData = { asset_digest: "sha256-matching-digest", signature: "sig-valid" };

      const res = await checkPresignLicence("upload");
      expect(res).toEqual({
        ok: true,
        enforced: true,
        deviceId: "DEV-PRO-1",
        licenceKey: "LIC-PRO-1",
      });
    });
  });
});
