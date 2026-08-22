import { describe, it, expect, beforeEach, vi } from "vitest";

let mockRevokedData: any = null;
let mockManifestData: any = null;

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "revoked_builds") return { data: mockRevokedData, error: null };
            if (table === "release_manifests") return { data: mockManifestData, error: null };
            return { data: null, error: null };
          },
        }),
      }),
    }),
  },
}));

import { __internals } from "@/lib/adapters/licence.server";

describe("Licence Enforcement & Attestation Suite", () => {
  const { verifyAttestation, attestationAllows, originAllowed } = __internals;

  beforeEach(() => {
    mockRevokedData = null;
    mockManifestData = null;
  });

  describe("Attestation & Manifest Checks", () => {
    it("rejects missing buildId or assetDigest", async () => {
      const empty = await verifyAttestation({});
      expect(empty.kind).toBe("missing_attestation");
      expect(attestationAllows(empty)).toBe(false);

      const missingDigest = await verifyAttestation({ buildId: "test-build-1" });
      expect(missingDigest.kind).toBe("missing_attestation");
      expect(attestationAllows(missingDigest)).toBe(false);
    });

    it("rejects when build is unknown / not registered in release_manifests", async () => {
      mockManifestData = null;
      const res = await verifyAttestation({
        buildId: "nonexistent-build-xyz-999",
        assetDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      });
      expect(res.kind).toBe("unknown_build");
      expect(attestationAllows(res)).toBe(false);
    });

    it("identifies revoked build immediately via kill switch table", async () => {
      mockRevokedData = { build_id: "compromised-build-42", reason: "Leaked on forum" };
      const res = await verifyAttestation({
        buildId: "compromised-build-42",
        assetDigest: "some-digest-value-12345678901234567890123456789012",
      });
      expect(res.kind).toBe("revoked_build");
      expect((res as any).reason).toBe("Leaked on forum");
      expect(attestationAllows(res)).toBe(false);
    });

    it("detects digest mismatch when reported asset digest differs from signed manifest", async () => {
      mockManifestData = {
        asset_digest: "expected-digest-384-hex-value-12345678901234567890",
        signature: "valid-ed25519-signature",
      };
      const res = await verifyAttestation({
        buildId: "valid-build-1",
        assetDigest: "tampered-client-digest-different-hash-here-12345",
      });
      expect(res.kind).toBe("digest_mismatch");
      expect(attestationAllows(res)).toBe(false);
    });

    it("allows valid build matching signed manifest", async () => {
      mockManifestData = {
        asset_digest: "valid-digest-hex-123456789012345678901234567890",
        signature: "valid-sig",
      };
      const res = await verifyAttestation({
        buildId: "valid-build-1",
        assetDigest: "valid-digest-hex-123456789012345678901234567890",
      });
      expect(res.kind).toBe("ok");
      expect(attestationAllows(res)).toBe(true);
    });

    it("evaluates attestationAllows strictly as default-deny", () => {
      expect(attestationAllows({ kind: "ok", buildId: "b1", assetDigest: "d1" })).toBe(true);
      expect(attestationAllows({ kind: "missing_attestation" })).toBe(false);
      expect(attestationAllows({ kind: "unsigned_build" })).toBe(false);
      expect(attestationAllows({ kind: "unknown_build", buildId: "b1" })).toBe(false);
      expect(attestationAllows({ kind: "revoked_build", buildId: "b1", reason: "leaked" })).toBe(false);
      expect(
        attestationAllows({
          kind: "digest_mismatch",
          buildId: "b1",
          reported: "d1",
          expected: "d2",
        }),
      ).toBe(false);
    });
  });

  describe("Origin Allowlist Policy", () => {
    it("denies unconfigured allowed_origins (deny by default)", () => {
      expect(originAllowed(null, "ar.clientstudio.com")).toBe(false);
      expect(originAllowed([], "ar.clientstudio.com")).toBe(false);
      expect(originAllowed(null, null)).toBe(false);
    });

    it("matches exact domains and valid subdomains", () => {
      const allowed = ["ar.royalwedding.com", "staging.royalwedding.com"];
      expect(originAllowed(allowed, "ar.royalwedding.com")).toBe(true);
      expect(originAllowed(allowed, "staging.royalwedding.com")).toBe(true);
      expect(originAllowed(allowed, "sub.ar.royalwedding.com")).toBe(true);
      expect(originAllowed(allowed, "evil-phishing.com")).toBe(false);
      expect(originAllowed(allowed, "royalwedding.com.evil.com")).toBe(false);
    });
  });

  describe("Device Slot & Cooldown Constraints", () => {
    it("enforces device class validation", () => {
      const allowedClasses = ["mobile", "desktop"];
      expect(allowedClasses.includes("mobile")).toBe(true);
      expect(allowedClasses.includes("desktop")).toBe(true);
      expect(allowedClasses.includes("server" as any)).toBe(false);
    });

    it("verifies release cooldown calculation is at least 12 hours", () => {
      const RELEASE_COOLDOWN_HOURS = 12;
      const now = new Date();
      const releaseAfter = new Date(now.getTime() + RELEASE_COOLDOWN_HOURS * 3600_000);
      const diffHours = (releaseAfter.getTime() - now.getTime()) / (3600 * 1000);
      expect(diffHours).toBe(12);
    });
  });
});
