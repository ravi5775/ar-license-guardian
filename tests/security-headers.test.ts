import { describe, it, expect } from "vitest";
import { applySecurityHeaders, SECURITY_HEADERS } from "../src/start";

describe("Security Headers & Defense-in-Depth Verification", () => {
  const REQUIRED_SECURITY_HEADERS = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "strict-transport-security",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "permissions-policy",
  ];

  it("applies all enterprise security headers to real HTTP Response objects", () => {
    const rawResponse = new Response("<html><body>Aether AR</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });

    const testReqId = "req_trace_test_123456";
    const securedResponse = applySecurityHeaders(rawResponse, testReqId);

    // Verify all required security headers are set on the actual Response instance
    for (const header of REQUIRED_SECURITY_HEADERS) {
      expect(securedResponse.headers.has(header)).toBe(true);
      const val = securedResponse.headers.get(header);
      expect(val).toBeDefined();
      expect(val?.length).toBeGreaterThan(0);
    }

    // Verify correlation ID is injected
    expect(securedResponse.headers.get("x-request-id")).toBe(testReqId);
  });

  it("verifies CSP policy structure on live response", () => {
    const rawResponse = new Response("{}", { status: 200 });
    const secured = applySecurityHeaders(rawResponse);
    const csp = secured.headers.get("content-security-policy") || "";

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it("verifies Permissions-Policy restricts camera to self and disables geolocation", () => {
    const rawResponse = new Response("{}", { status: 200 });
    const secured = applySecurityHeaders(rawResponse);
    const perm = secured.headers.get("permissions-policy") || "";

    expect(perm).toContain("camera=(self)");
    expect(perm).toContain("microphone=()");
    expect(perm).toContain("geolocation=()");
  });

  it("verifies frame busting and anti-MIME sniffing headers", () => {
    const rawResponse = new Response("{}", { status: 200 });
    const secured = applySecurityHeaders(rawResponse);

    expect(secured.headers.get("x-frame-options")).toBe("DENY");
    expect(secured.headers.get("x-content-type-options")).toBe("nosniff");
    expect(secured.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(secured.headers.get("strict-transport-security")).toContain("max-age=63072000");
  });
});

