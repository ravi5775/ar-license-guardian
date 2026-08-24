/**
 * Security regression tests for the critical fixes applied in the
 * 2026-08-20 enterprise audit:
 *
 *  FIX-1: Legacy /api/public/license/activate returns 410 Gone
 *  FIX-2: Memory rate-limiter blocked on admin/edge builds
 *  FIX-3: GLB and MIND magic-byte validation is real, not a no-op
 *  FIX-4: LICENCE_ROLE defaults to "client" (least privilege)
 *  FIX-5: empty allowed_origins → ORIGIN_NOT_ALLOWED (deny by default)
 *  FIX-6: client-schema.sql no longer contains weak RLS policy definitions
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { validateMagicBytes } from "../src/lib/upload-security";

// ---------------------------------------------------------------------------
// FIX-3: GLB and MIND magic-byte validation
// ---------------------------------------------------------------------------
describe("FIX-3: GLB magic-byte validation is no longer a no-op", () => {
  it("accepts a valid GLB file (gltF magic)", () => {
    // Binary glTF 2.0 magic: 0x67 0x6C 0x54 0x46
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(glb, "glb")).toBe(true);
  });

  it("rejects a file with a spoofed .glb extension (PHP content)", () => {
    const php = new Uint8Array([0x3c, 0x3f, 0x70, 0x68, 0x70, 0x20, 0x65, 0x63]); // "<?php ec"
    expect(validateMagicBytes(php, "glb")).toBe(false);
  });

  it("rejects a PNG file renamed to .glb", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateMagicBytes(png, "glb")).toBe(false);
  });

  it("rejects a JPEG file renamed to .glb", () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(validateMagicBytes(jpg, "glb")).toBe(false);
  });

  it("rejects an <script> payload renamed to .glb", () => {
    const script = new Uint8Array([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3e]); // "<script>"
    expect(validateMagicBytes(script, "glb")).toBe(false);
  });
});

describe("FIX-3: MIND magic-byte validation is no longer a no-op", () => {
  it("accepts a valid MIND file (MIND magic)", () => {
    // MindAR .mind magic: 0x4D 0x49 0x4E 0x44 ("MIND")
    const mind = new Uint8Array([0x4d, 0x49, 0x4e, 0x44, 0x01, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(mind, "mind")).toBe(true);
  });

  it("rejects a file with a spoofed .mind extension (HTML content)", () => {
    const html = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x00, 0x00]); // "<html>"
    expect(validateMagicBytes(html, "mind")).toBe(false);
  });

  it("rejects a GLB file renamed to .mind", () => {
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(glb, "mind")).toBe(false);
  });

  it("rejects a ZIP bomb renamed to .mind", () => {
    // ZIP magic: PK\x03\x04
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(zip, "mind")).toBe(false);
  });

  it("rejects an all-zeros buffer renamed to .mind", () => {
    const zeros = new Uint8Array(8);
    expect(validateMagicBytes(zeros, "mind")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FIX-4: LICENCE_ROLE defaults to "client"
// ---------------------------------------------------------------------------
describe("FIX-4: LICENCE_ROLE defaults to least privilege (client)", () => {
  const original = process.env["LICENCE_ROLE"];

  afterEach(() => {
    if (original === undefined) {
      delete process.env["LICENCE_ROLE"];
    } else {
      process.env["LICENCE_ROLE"] = original;
    }
  });

  it("returns 'client' when LICENCE_ROLE is not set", async () => {
    delete process.env["LICENCE_ROLE"];
    // Re-import to pick up changed env (vitest does not cache module singletons)
    const { licenceRole } = await import("../src/lib/adapters/env.server");
    expect(licenceRole()).toBe("client");
  });

  it("returns 'issuer' when LICENCE_ROLE=issuer is explicitly set", async () => {
    process.env["LICENCE_ROLE"] = "issuer";
    const { licenceRole } = await import("../src/lib/adapters/env.server");
    expect(licenceRole()).toBe("issuer");
  });

  it("returns 'client' when LICENCE_ROLE=client is explicitly set", async () => {
    process.env["LICENCE_ROLE"] = "client";
    const { licenceRole } = await import("../src/lib/adapters/env.server");
    expect(licenceRole()).toBe("client");
  });
});

// ---------------------------------------------------------------------------
// FIX-5: originAllowed denies when allowed_origins is empty or null
// ---------------------------------------------------------------------------
describe("FIX-5: originAllowed denies empty / null allowed_origins", () => {
  /**
   * We test the __internals export which exposes originAllowed for unit testing.
   * This avoids the need for a running database.
   */
  it("denies when allowed_origins is null", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed(null, "example.com")).toBe(false);
  });

  it("denies when allowed_origins is an empty array", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed([], "example.com")).toBe(false);
  });

  it("denies when allowed_origins is empty and host is also null", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed([], null)).toBe(false);
  });

  it("allows when the host exactly matches an allowed origin", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed(["example.com"], "example.com")).toBe(true);
  });

  it("allows when the host is a subdomain of an allowed origin", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed(["example.com"], "app.example.com")).toBe(true);
  });

  it("denies when the host does NOT match any allowed origin", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed(["allowed.com"], "attacker.com")).toBe(false);
  });

  it("denies when host is null even if allowed_origins is configured", async () => {
    const { __internals } = await import("../src/lib/adapters/licence.server");
    expect(__internals.originAllowed(["example.com"], null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FIX-1: Legacy endpoint tombstone
// ---------------------------------------------------------------------------
describe("FIX-1: legacy /api/public/license/activate returns 410 Gone", () => {
  it("tombstone route module exports a route pointing to the legacy path", async () => {
    /**
     * We can't make a live HTTP request in unit tests, but we can verify the
     * route file is a pure tombstone: it must NOT import any activation logic,
     * must NOT import notify.server or licence.server, and must NOT contain
     * any Zod schema that processes activation payloads.
     */
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "src/routes/api/public/license/activate.ts",
      "utf8",
    );

    // Must NOT contain any activation logic
    expect(content).not.toContain("ActivateSchema");
    expect(content).not.toContain("sendDuplicateFingerprintAlert");
    expect(content).not.toContain("license_activations");
    expect(content).not.toContain("handleActivate");

    // Must signal removal
    expect(content).toContain("410");
    expect(content).toContain("ENDPOINT_REMOVED");
    expect(content).toContain("/api/public/licence/activate");
  });
});

// ---------------------------------------------------------------------------
// FIX-2: Memory rate-limiter blocked on admin/edge builds
// ---------------------------------------------------------------------------
describe("FIX-2: memory rate-limiter blocked on admin and edge builds", () => {
  it("denies (allowed=false, degraded=true) when RATELIMIT_DRIVER=memory on an admin build", async () => {
    // check() wraps backend errors with failMode:"closed" → { allowed: false, degraded: true }.
    // We verify: the memory backend throws, and that error surfaces as a denied+degraded result.
    const saved = {
      RATELIMIT_DRIVER: process.env["RATELIMIT_DRIVER"],
      LICENCE_ROLE: process.env["LICENCE_ROLE"],
      RUNTIME: process.env["RUNTIME"],
      NODE_ENV: process.env["NODE_ENV"],
    };
    process.env["RATELIMIT_DRIVER"] = "memory";
    process.env["LICENCE_ROLE"] = "issuer";
    process.env["RUNTIME"] = "node";
    process.env["NODE_ENV"] = "development";

    const { __setBackend, check } = await import("../src/lib/adapters/ratelimit.server");
    __setBackend(null); // reset singleton

    const result = await check("test_admin_block", 10, 60, { failMode: "closed" });
    // Backend threw; check() caught it and returned fail-closed.
    expect(result.allowed).toBe(false);
    expect(result.degraded).toBe(true);

    // Restore
    Object.assign(process.env, saved);
    __setBackend(null);
  });

  it("denies (allowed=false, degraded=true) when RATELIMIT_DRIVER=memory on an edge runtime", async () => {
    const saved = {
      RATELIMIT_DRIVER: process.env["RATELIMIT_DRIVER"],
      LICENCE_ROLE: process.env["LICENCE_ROLE"],
      RUNTIME: process.env["RUNTIME"],
      NODE_ENV: process.env["NODE_ENV"],
    };
    process.env["RATELIMIT_DRIVER"] = "memory";
    process.env["LICENCE_ROLE"] = "client";
    process.env["RUNTIME"] = "edge";
    process.env["NODE_ENV"] = "development";

    const { __setBackend, check } = await import("../src/lib/adapters/ratelimit.server");
    __setBackend(null);

    const result = await check("test_edge_block", 10, 60, { failMode: "closed" });
    expect(result.allowed).toBe(false);
    expect(result.degraded).toBe(true);

    Object.assign(process.env, saved);
    __setBackend(null);
  });

  it("allows memory driver on a client/node development build", async () => {
    const saved = {
      RATELIMIT_DRIVER: process.env["RATELIMIT_DRIVER"],
      LICENCE_ROLE: process.env["LICENCE_ROLE"],
      RUNTIME: process.env["RUNTIME"],
      NODE_ENV: process.env["NODE_ENV"],
    };
    process.env["RATELIMIT_DRIVER"] = "memory";
    process.env["LICENCE_ROLE"] = "client";
    process.env["RUNTIME"] = "node";
    process.env["NODE_ENV"] = "development";

    const { __setBackend, check } = await import("../src/lib/adapters/ratelimit.server");
    __setBackend(null);

    // Should not throw and should return allowed:true, degraded not set
    const result = await check(`dev_test_${Date.now()}`, 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.degraded).toBeUndefined();

    Object.assign(process.env, saved);
    __setBackend(null);
  });
});


// ---------------------------------------------------------------------------
// FIX-6: client-schema.sql must not contain weak RLS policy definitions
// ---------------------------------------------------------------------------
describe("FIX-6: client-schema.sql does not reinstall weak RLS policies", () => {
  it("does not contain albums_public_read policy granting access to authenticated role", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("supabase/client-schema.sql", "utf8");

    // The weak policy granted SELECT to authenticated — any published album
    // visible to all tenants. This line must not exist.
    expect(sql).not.toMatch(/FOR SELECT TO anon, authenticated\s+USING \(published = true\)/);
  });

  it("does not contain CREATE POLICY for albums that targets authenticated without owner_id check", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("supabase/client-schema.sql", "utf8");

    // The weak albums_owner_all covered all operations without is_approved().
    // Ensure no broad FOR ALL policy on albums exists in this file.
    const albumsPolicyMatch = sql.match(/CREATE POLICY.*ON public\.albums/g) ?? [];
    expect(albumsPolicyMatch.length).toBe(0);
  });

  it("does not contain CREATE POLICY for ar_experiences targeting authenticated without owner_id", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("supabase/client-schema.sql", "utf8");

    const expPolicyMatch = sql.match(/CREATE POLICY.*ON public\.ar_experiences/g) ?? [];
    expect(expPolicyMatch.length).toBe(0);
  });

  it("contains a warning comment directing maintainers to use migrations", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("supabase/client-schema.sql", "utf8");

    // Verify the guard comment is present
    expect(sql).toContain("Do NOT define album RLS policies here");
    expect(sql).toContain("OVERWRITE the secure policies");
  });
});
