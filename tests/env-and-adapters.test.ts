import { describe, it, expect } from "vitest";
import {
  readEnv,
  requireEnv,
  dbDriver,
  rateLimitDriver,
  licenceRole,
  runtime,
} from "../src/lib/adapters/env.server";
import { check } from "../src/lib/adapters/ratelimit.server";
import {
  logger,
  maskSensitiveData,
  normalizeUserError,
} from "../src/lib/enterprise-logger";
import { scopeUploadPath, ownsUploadPath, type UploaderIdentity } from "../src/lib/uploader-guard.server";

describe("Environment & Multi-Driver Adapters", () => {
  it("readEnv returns value when present and fallback when missing", () => {
    process.env.TEST_SAMPLE_VAR = "hello_world";
    expect(readEnv("TEST_SAMPLE_VAR", "fallback")).toBe("hello_world");
    expect(readEnv("NON_EXISTENT_VAR_XYZ", "fallback")).toBe("fallback");
  });

  it("requireEnv throws informative error on missing required env var", () => {
    delete process.env.MISSING_SECRET_KEY;
    expect(() => requireEnv("MISSING_SECRET_KEY")).toThrow(
      "Missing required environment variable: MISSING_SECRET_KEY",
    );
  });

  it("correctly identifies deployment roles and runtime drivers", () => {
    process.env.RUNTIME = "node";
    process.env.DB_DRIVER = "postgres";
    process.env.RATELIMIT_DRIVER = "memory";
    process.env.LICENCE_ROLE = "client";

    expect(runtime()).toBe("node");
    expect(dbDriver()).toBe("postgres");
    expect(rateLimitDriver()).toBe("memory");
    expect(licenceRole()).toBe("client");
  });
});

describe("In-Memory Rate Limiting & Fail-Safe Mechanics", () => {
  it("enforces sliding-window limits and tracks remaining slots", async () => {
    process.env.RATELIMIT_DRIVER = "memory";
    const key = `test_key_${Date.now()}`;

    const r1 = await check(key, 2, 60);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = await check(key, 2, 60);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = await check(key, 2, 60);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });
});

describe("Enterprise Logger & Masking", () => {
  it("masks passwords, tokens, and secret keys in log metadata", () => {
    const raw = {
      username: "john_doe",
      password: "SuperSecretPassword123!",
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token",
      apiKey: "sk-live-1234567890abcdef",
      nested: {
        pin_hash: "$2b$10$abcdefghijk",
        safeData: "public_value",
      },
    };

    const masked = maskSensitiveData(raw);

    expect(masked.username).toBe("john_doe");
    expect(masked.password).not.toBe("SuperSecretPassword123!");
    expect(masked.password).toContain("***");
    expect(masked.token).toContain("***");
    expect(masked.nested.pin_hash).toContain("***");
    expect(masked.nested.safeData).toBe("public_value");
  });

  it("normalizes user-facing errors while logging details internally", () => {
    const userSafe = new Error("Incorrect PIN. 3 attempts remaining.");
    const internalCrash = new Error("Postgres connection pool exhausted at 10.0.0.4:5432");

    const safeRes = normalizeUserError(userSafe);
    expect(safeRes.ok).toBe(false);
    expect(safeRes.error).toContain("Incorrect PIN");

    const maskedRes = normalizeUserError(internalCrash);
    expect(maskedRes.ok).toBe(false);
    expect(maskedRes.error).toBe("An unexpected error occurred. Please try again later.");
  });
});

describe("Uploader Guard & Path Namespace Scoping", () => {
  const userA: UploaderIdentity = { userId: "user-123", isAdmin: false };
  const admin: UploaderIdentity = { userId: "admin-999", isAdmin: true };

  it("scopes regular user paths under their userId directory", () => {
    const raw = "wedding/marker.jpg";
    const scoped = scopeUploadPath(userA, raw);
    expect(scoped).toBe("u/user-123/wedding/marker.jpg");
  });

  it("allows admins to manage un-prefixed paths", () => {
    const raw = "system/global-asset.mind";
    const scoped = scopeUploadPath(admin, raw);
    expect(scoped).toBe("system/global-asset.mind");
  });

  it("verifies path ownership and blocks cross-tenant path hijacking", () => {
    expect(ownsUploadPath(userA, "u/user-123/wedding/marker.jpg")).toBe(true);
    expect(ownsUploadPath(userA, "u/user-456/wedding/marker.jpg")).toBe(false);
    expect(ownsUploadPath(admin, "u/user-456/wedding/marker.jpg")).toBe(true);
  });
});
