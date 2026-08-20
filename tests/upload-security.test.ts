import { describe, it, expect } from "vitest";
import {
  validateMagicBytes,
  sanitizeFilename,
  validateUploadPayload,
} from "../src/lib/upload-security";

describe("Upload Security & Magic-Byte Validation", () => {
  it("recognizes valid PNG magic bytes", () => {
    // 89 50 4E 47 (PNG)
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateMagicBytes(pngHeader, "png")).toBe(true);
    expect(validateMagicBytes(pngHeader, "jpg")).toBe(false);
  });

  it("recognizes valid JPEG magic bytes", () => {
    // FF D8 FF (JPEG)
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateMagicBytes(jpegHeader, "jpg")).toBe(true);
    expect(validateMagicBytes(jpegHeader, "jpeg")).toBe(true);
    expect(validateMagicBytes(jpegHeader, "png")).toBe(false);
  });

  it("recognizes MP4 ftyp box signature", () => {
    // offset 4: 'ftyp'
    const mp4Header = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(validateMagicBytes(mp4Header, "mp4")).toBe(true);
  });

  it("recognizes WebM EBML header", () => {
    // 1A 45 DF A3 (WebM)
    const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
    expect(validateMagicBytes(webmHeader, "webm")).toBe(true);
  });

  it("rejects malicious file with spoofed extension", () => {
    const textBuffer = new Uint8Array([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]); // '<script'
    expect(validateMagicBytes(textBuffer, "png")).toBe(false);
    expect(validateMagicBytes(textBuffer, "mp4")).toBe(false);
  });

  it("sanitizes filename and prevents directory traversal attacks", () => {
    const malicious = "../../../etc/passwd.png";
    const sanitized = sanitizeFilename(malicious);
    expect(sanitized).not.toContain("..");
    expect(sanitized).not.toContain("/");
    expect(sanitized.endsWith(".png")).toBe(true);
  });

  it("rejects disallowed file extensions", () => {
    expect(() => sanitizeFilename("payload.exe")).toThrow("Disallowed file extension");
    expect(() => sanitizeFilename("script.php")).toThrow("Disallowed file extension");
  });

  it("validates full upload payload correctly", async () => {
    const validFile = { name: "wedding.mp4", type: "video/mp4", size: 10 * 1024 * 1024 };
    const mp4Header = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
    const res = await validateUploadPayload(validFile, mp4Header);
    expect(res.ok).toBe(true);

    const oversized = { name: "large.mp4", type: "video/mp4", size: 60 * 1024 * 1024 };
    const overRes = await validateUploadPayload(oversized);
    expect(overRes.ok).toBe(false);
    if (!overRes.ok) {
      expect(overRes.error).toContain("exceeds the 50 MB limit");
    }
  });
});
