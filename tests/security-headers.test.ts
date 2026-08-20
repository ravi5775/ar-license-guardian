import { describe, it, expect } from "vitest";

describe("Security Headers & Defense-in-Depth Verification", () => {
  const REQUIRED_SECURITY_HEADERS = [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "Permissions-Policy",
  ];

  it("verifies all required enterprise headers are defined in security policy", async () => {
    // Dynamically inspect start.ts middleware definition
    const startContent = await Bun.file("src/start.ts").text();

    for (const header of REQUIRED_SECURITY_HEADERS) {
      expect(startContent).toContain(`"${header}"`);
    }
  });

  it("verifies CSP policy explicitly disallows object-src and frames", async () => {
    const startContent = await Bun.file("src/start.ts").text();

    expect(startContent).toContain("object-src 'none'");
    expect(startContent).toContain("frame-ancestors 'none'");
    expect(startContent).toContain("base-uri 'self'");
  });

  it("verifies camera permission is restricted to self for AR", async () => {
    const startContent = await Bun.file("src/start.ts").text();

    expect(startContent).toContain("camera=(self)");
    expect(startContent).toContain("microphone=()");
    expect(startContent).toContain("geolocation=()");
  });
});
