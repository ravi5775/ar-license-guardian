/**
 * ============================================================================
 * AETHER AR — Server-Side Asset Watermarking
 * ============================================================================
 * Implements server-side watermark embedding for generated `.mind` files
 * and media metadata before assets are returned to client deployments.
 *
 * Because this is applied on the vendor infrastructure during asset processing:
 *   1. It cannot be stripped by modifying client frontend code.
 *   2. Re-distributing raw assets retains the original customer attribution.
 * ============================================================================
 */

import { createHash } from "node:crypto";

export interface WatermarkMetadata {
  customerId: string;
  licenseKey: string;
  albumId: string;
  generatedAt?: string;
}

/**
 * Embeds a forensic provenance header into a binary buffer (e.g. .mind file).
 * Prepends a non-destructive custom magic chunk:
 *   [0x41, 0x45, 0x54, 0x48] ("AETH") + [payloadLength (4 bytes)] + JSON string
 */
export function embedMindWatermark(
  mindBuffer: Buffer | Uint8Array,
  meta: WatermarkMetadata,
): Buffer {
  const payload = JSON.stringify({
    cid: meta.customerId,
    lic: meta.licenseKey.slice(0, 8) + "***",
    aid: meta.albumId,
    ts: meta.generatedAt || new Date().toISOString(),
    h: createHash("sha256")
      .update(`${meta.customerId}:${meta.licenseKey}:${meta.albumId}`)
      .digest("hex")
      .slice(0, 16),
  });

  const payloadBuf = Buffer.from(payload, "utf-8");
  const headerBuf = Buffer.alloc(8 + payloadBuf.length);

  // Magic bytes "AETH"
  headerBuf.write("AETH", 0, 4, "ascii");
  // Payload length (32-bit uint big-endian)
  headerBuf.writeUInt32BE(payloadBuf.length, 4);
  // Payload
  payloadBuf.copy(headerBuf, 8);

  return Buffer.concat([headerBuf, Buffer.from(mindBuffer)]);
}

/**
 * Extracts embedded provenance metadata from a suspect .mind binary file.
 */
export function extractMindWatermark(buffer: Buffer | Uint8Array): WatermarkMetadata | null {
  const buf = Buffer.from(buffer);
  if (buf.length < 8) return null;

  // Check magic bytes "AETH"
  if (buf.toString("ascii", 0, 4) !== "AETH") {
    return null;
  }

  const payloadLength = buf.readUInt32BE(4);
  if (payloadLength > 4096 || buf.length < 8 + payloadLength) {
    return null;
  }

  try {
    const jsonStr = buf.toString("utf-8", 8, 8 + payloadLength);
    const parsed = JSON.parse(jsonStr);
    return {
      customerId: parsed.cid,
      licenseKey: parsed.lic,
      albumId: parsed.aid,
      generatedAt: parsed.ts,
    };
  } catch {
    return null;
  }
}
