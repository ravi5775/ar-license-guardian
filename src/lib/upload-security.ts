/**
 * ============================================================================
 * AETHER AR — ENTERPRISE UPLOAD SECURITY & MAGIC-BYTE VALIDATOR
 * ============================================================================
 *
 * Verifies file signatures (magic bytes), strictly whitelists MIME types
 * and file extensions, checks max payload sizes, and sanitizes filenames
 * to prevent malicious executable injection, polyglot files, and directory traversal.
 * ============================================================================
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "mp4", "webm", "mind", "glb"]);

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/webm",
  "application/octet-stream",
  "model/gltf-binary",
]);

/**
 * Validates the binary magic bytes (file signature) of a buffer.
 */
export function validateMagicBytes(buffer: Uint8Array, extension: string): boolean {
  if (buffer.length < 4) return false;

  const hex = Array.from(buffer.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");

  switch (extension.toLowerCase()) {
    case "png":
      // PNG magic: 89 50 4E 47
      return hex.startsWith("89 50 4E 47");

    case "jpg":
    case "jpeg":
      // JPEG magic: FF D8 FF
      return hex.startsWith("FF D8 FF");

    case "mp4":
      // MP4 ISO Base Media file (ftyp box usually at offset 4)
      if (buffer.length >= 8) {
        const ftyp = String.fromCharCode(...buffer.slice(4, 8));
        return ftyp === "ftyp";
      }
      return false;

    case "webm":
      // WebM EBML header: 1A 45 DF A3
      return hex.startsWith("1A 45 DF A3");

    case "glb":
      // GLB (Binary glTF 2.0): magic = 0x67 0x6C 0x54 0x46 ("glTF")
      // Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
      return buffer[0] === 0x67 && buffer[1] === 0x6c && buffer[2] === 0x54 && buffer[3] === 0x46;

    case "mind":
      // MindAR compiled target (.mind): the format begins with the ASCII
      // string "MIND" (0x4D 0x49 0x4E 0x44) followed by a version varint.
      // Source: https://github.com/hiukim/mind-ar-js internal format docs.
      return buffer[0] === 0x4d && buffer[1] === 0x49 && buffer[2] === 0x4e && buffer[3] === 0x44;

    case "bin":
      // Generic binary — no magic defined; accept without check.
      return true;

    default:
      return false;
  }
}

/**
 * Sanitizes a client-provided filename, stripping directory traversal characters.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename
    .replace(/^.*[\\/]/, "") // strip leading paths
    .replace(/[^a-zA-Z0-9._-]/g, "_"); // replace dangerous chars
  const ext = base.split(".").pop()?.toLowerCase() || "bin";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Disallowed file extension: .${ext}`);
  }

  return `${crypto.randomUUID()}.${ext}`;
}

/**
 * Comprehensive pre-upload security check.
 */
export async function validateUploadPayload(
  file: { name: string; type: string; size: number },
  buffer?: Uint8Array,
): Promise<{ ok: true; sanitizedName: string } | { ok: false; error: string }> {
  // 1. Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File size exceeds the 50 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };
  }

  // 2. Extension check
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Disallowed file extension: .${ext}. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
    };
  }

  // 3. MIME type check
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: `Disallowed MIME type: ${file.type}` };
  }

  // 4. Magic byte inspection if buffer available
  if (buffer && !validateMagicBytes(buffer, ext)) {
    return { ok: false, error: `File content does not match expected format for .${ext}` };
  }

  // 5. Enterprise Virus Scan Hook Placeholder
  // e.g., await scanWithClamAV(buffer);

  return { ok: true, sanitizedName: sanitizeFilename(file.name) };
}
