import { describe, it, expect, beforeAll } from "vitest";
import { enforceRateLimit, getClientIp } from "../src/lib/rate-limiter.middleware";

describe("Enterprise Rate Limiting Middleware", () => {
  beforeAll(async () => {
    process.env.RATELIMIT_DRIVER = "memory";
    process.env.RUNTIME = "node";
    process.env.LICENCE_ROLE = "client";
    const { __setBackend } = await import("../src/lib/adapters/ratelimit.server");
    __setBackend(null);
  });

  it("correctly extracts IP from Cloudflare and proxy headers", () => {
    const cfReq = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "203.0.113.195" },
    });
    expect(getClientIp(cfReq)).toBe("203.0.113.195");

    const xForwardedReq = new Request("https://example.com", {
      headers: { "x-forwarded-for": "198.51.100.42, 10.0.0.1" },
    });
    expect(getClientIp(xForwardedReq)).toBe("198.51.100.42");
  });

  it("allows initial requests under the configured threshold", async () => {
    const req = new Request("https://example.com/api/test", {
      headers: { "cf-connecting-ip": `192.0.2.${Math.floor(Math.random() * 200)}` },
    });

    const response = await enforceRateLimit(req, {
      limit: 10,
      windowSec: 60,
      bucket: `test_${Date.now()}`,
    });

    expect(response).toBeNull();
  });

  it("returns HTTP 429 and Retry-After header when rate limit is exceeded", async () => {
    const ip = `192.0.2.99`;
    const bucket = `exceed_test_${Date.now()}`;
    const req = new Request("https://example.com/api/test", {
      headers: { "cf-connecting-ip": ip },
    });

    // Exhaust limit (limit = 2)
    await enforceRateLimit(req, { limit: 2, windowSec: 30, bucket });
    await enforceRateLimit(req, { limit: 2, windowSec: 30, bucket });

    // Third request must be blocked
    const blocked = await enforceRateLimit(req, { limit: 2, windowSec: 30, bucket });

    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("30");
    const body = await blocked?.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("TOO_MANY_REQUESTS");
  });
});
