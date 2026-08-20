import { describe, it, expect } from "vitest";
import {
  sanitizeExperience,
  sanitizeAlbum,
  sanitizeActivation,
  sanitizeProfile,
} from "../src/lib/dto-sanitizer";

describe("DTO Sanitizer & Least-Privilege Response Serialization", () => {
  it("strips pin_hash from experience rows and exposes has_pin boolean", () => {
    const raw = {
      id: "exp-123",
      title: "Wedding AR Card",
      slug: "wedding-card",
      pin_hash: "$2b$10$e8wF9aK1L9Xz2mQ.J3e1A.examplehash",
      owner_id: "user-1",
      published: true,
    };

    const sanitized = sanitizeExperience(raw as any);

    expect(sanitized.id).toBe("exp-123");
    expect(sanitized.title).toBe("Wedding AR Card");
    expect((sanitized as any).pin_hash).toBeUndefined();
    expect(sanitized.has_pin).toBe(true);
  });

  it("handles experience with no PIN correctly", () => {
    const raw = {
      id: "exp-456",
      title: "Public AR Poster",
      slug: "public-poster",
      pin_hash: null,
      owner_id: "user-2",
    };

    const sanitized = sanitizeExperience(raw as any);
    expect((sanitized as any).pin_hash).toBeUndefined();
    expect(sanitized.has_pin).toBe(false);
  });

  it("strips pin_hash from album rows and preserves targets", () => {
    const raw = {
      id: "album-1",
      title: "Summer Wedding Album",
      slug: "summer-wedding",
      pin_hash: "$2b$10$anotherBcryptHash12345",
      owner_id: "user-1",
      ar_experiences: [{ id: "exp-1", title: "Page 1", target_index: 0 }],
    };

    const sanitized = sanitizeAlbum(raw as any);

    expect(sanitized.id).toBe("album-1");
    expect((sanitized as any).pin_hash).toBeUndefined();
    expect(sanitized.has_pin).toBe(true);
    expect(sanitized.ar_experiences).toHaveLength(1);
  });

  it("strips device_secret_hash from license activation entities", () => {
    const raw = {
      id: "act-1",
      license_id: "lic-1",
      fingerprint: "fp_abc123",
      device_secret_hash: "sha256_internal_secret_hash",
      device_class: "desktop",
    };

    const sanitized = sanitizeActivation(raw as any);

    expect(sanitized.id).toBe("act-1");
    expect(sanitized.fingerprint).toBe("fp_abc123");
    expect((sanitized as any).device_secret_hash).toBeUndefined();
  });

  it("returns only allowed public profile fields", () => {
    const raw = {
      id: "usr-1",
      email: "client@studio.com",
      display_name: "Studio Admin",
      avatar_url: "https://avatar.png",
      approval_status: "approved",
      storage_quota_bytes: 2147483648,
      internal_secret_note: "Should be stripped",
    };

    const sanitized = sanitizeProfile(raw as any);

    expect(sanitized.id).toBe("usr-1");
    expect(sanitized.display_name).toBe("Studio Admin");
    expect((sanitized as any).internal_secret_note).toBeUndefined();
  });
});
