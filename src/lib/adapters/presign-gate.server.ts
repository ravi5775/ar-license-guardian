/**
 * §4.7 — presign gating. The one licence control with real teeth.
 *
 * Media lives in a bucket with no public read policy, so nothing is delivered
 * without a server-minted signed URL. This module is the single place that
 * decides whether the calling device may get one: it re-verifies the signed
 * licence token, the licence row, the device slot and the build attestation
 * on EVERY presign — uploads and AR runtime asset fetches alike.
 *
 * Fail-closed by design: when enforcement is on, anything unproven is denied.
 * When `LICENCE_ENFORCE_PRESIGN` is not "true" (our own admin deployment,
 * local dev), the gate reports `enforced: false` and allows — enforcement is
 * a deployment decision, never a client-supplied one.
 */
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { readEnv } from "./env.server";

/** Set by the client licence runtime so SSR loaders and serverFns both see it. */
export const LICENCE_COOKIE = "aether_licence";
/** Header alternative for non-browser callers (native shells, tests). */
export const LICENCE_HEADER = "x-aether-licence";

export type PresignPurpose = "upload" | "media_fetch";

export type GateResult =
  | { ok: true; enforced: boolean; deviceId?: string; licenceKey?: string }
  | { ok: false; reason: string; message: string };

/**
 * Enforcement is a deployment decision, never a client-supplied one.
 *
 * It defaults to ON for a customer deployment (`LICENCE_ROLE=client`), so a
 * missing or dropped env var can never silently disable the only control with
 * real teeth. Turning it off there requires an explicit
 * `LICENCE_ENFORCE_PRESIGN=false`. On the issuer deployment (our own admin
 * instance) and in local dev it defaults to OFF.
 */
export function presignGatingEnabled() {
  const raw = (readEnv("LICENCE_ENFORCE_PRESIGN") ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return (readEnv("LICENCE_ROLE") ?? "issuer").trim().toLowerCase() === "client";
}


interface TokenPayload {
  sub?: string;
  dep?: string;
  did?: string;
  platform?: string;
  plan?: string;
  grace?: number;
  iat?: number;
  exp?: number;
}

function b64ToBytes(b64: string) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Public JWK, either configured directly or derived from the signing key. */
function publicJwk(): JsonWebKey | null {
  const direct = readEnv("LICENCE_PUBLIC_KEY_JWK");
  if (direct) {
    try {
      return JSON.parse(direct) as JsonWebKey;
    } catch {
      return null;
    }
  }
  const priv = readEnv("LICENCE_PRIVATE_KEY_JWK");
  if (!priv) return null;
  try {
    const jwk = JSON.parse(priv) as JsonWebKey & { d?: string };
    const { kty, crv, x } = jwk;
    return { kty, crv, x, key_ops: ["verify"], ext: true } as JsonWebKey;
  } catch {
    return null;
  }
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  const jwk = publicJwk();
  if (!jwk) return null;
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, [
      "verify",
    ]);
    const valid = await crypto.subtle.verify(
      "Ed25519",
      key,
      b64ToBytes(sig) as BufferSource,
      new TextEncoder().encode(`${header}.${body}`),
    );
    if (!valid) return null;
    return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))) as TokenPayload;
  } catch {
    return null;
  }
}

function presentedToken(): string | null {
  const header = getRequestHeader(LICENCE_HEADER);
  if (header) return header.replace(/^Bearer\s+/i, "").trim();
  return getCookie(LICENCE_COOKIE) ?? null;
}

const deny = (reason: string, message: string): GateResult => ({
  ok: false,
  reason,
  message,
});

/**
 * Decide whether this request may be handed a presigned URL.
 * Never throws — callers translate the refusal into their own shape.
 */
export async function checkPresignLicence(
  purpose: PresignPurpose,
  projectId?: string,
): Promise<GateResult> {
  if (!presignGatingEnabled()) return { ok: true, enforced: false };

  const token = presentedToken();
  if (!token) {
    return deny(
      "LICENCE_MISSING",
      "This device has no active licence. Open the app once while online to activate it.",
    );
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.sub) {
    await safeViolation("presign_bad_token", { purpose });
    return deny("LICENCE_INVALID", "This device's licence could not be verified.");
  }

  // Online presign: the 24h token must be live. The 72h offline grace window
  // covers viewing already-loaded state, never minting fresh asset URLs.
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    return deny("LICENCE_EXPIRED_TOKEN", "This device's licence needs to refresh. Reload the page.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: licence } = await supabaseAdmin
    .from("licenses")
    .select("id, license_key, status, expires_at")
    .eq("license_key", payload.sub)
    .maybeSingle();
  if (!licence) {
    await safeViolation("presign_unknown_licence", { purpose, key: payload.sub });
    return deny("INVALID_LICENCE", "This licence is not recognised.");
  }
  if (licence.status !== "active") {
    return deny(
      `LICENCE_${String(licence.status).toUpperCase()}`,
      "This licence is not active. Contact your provider.",
    );
  }
  if (licence.expires_at && new Date(licence.expires_at) < new Date()) {
    return deny("LICENCE_EXPIRED", "This licence has expired.");
  }

  if (!payload.did) {
    await safeViolation("presign_no_device", { purpose }, licence.id, licence.license_key);
    return deny("DEVICE_UNKNOWN", "This device is not registered to the licence.");
  }

  const { data: device } = await supabaseAdmin
    .from("license_activations")
    .select("id, revoked_at, build_id, asset_digest, license_id")
    .eq("id", payload.did)
    .maybeSingle();
  if (!device || device.license_id !== licence.id) {
    await safeViolation("presign_no_device", { purpose }, licence.id, licence.license_key);
    return deny("DEVICE_UNKNOWN", "This device is not registered to the licence.");
  }
  if (device.revoked_at) {
    return deny(
      "DEVICE_RELEASED",
      "This device slot was released. Activate again to keep using the app.",
    );
  }

  // Attestation, re-checked at delivery time: the build this device last
  // reported must still match a signed release manifest. A tampered bundle
  // therefore stops getting media even if its token is still inside 24h.
  const buildId = (device.build_id ?? "").trim();
  const assetDigest = (device.asset_digest ?? "").trim();
  if (!buildId || !assetDigest) {
    await safeViolation("presign_missing_attestation", { purpose }, licence.id, licence.license_key);
    return deny("ATTESTATION_INVALID", "This build could not be verified.");
  }
  const { data: manifest } = await supabaseAdmin
    .from("release_manifests")
    .select("asset_digest, signature")
    .eq("build_id", buildId)
    .maybeSingle();
  if (!manifest || !manifest.signature || manifest.signature === "unsigned") {
    await safeViolation(
      "presign_unsigned_build",
      { purpose, buildId },
      licence.id,
      licence.license_key,
    );
    return deny("ATTESTATION_INVALID", "This build could not be verified.");
  }
  if (manifest.asset_digest !== assetDigest) {
    await safeViolation(
      "digest_mismatch",
      { purpose, buildId, reported: assetDigest, expected: manifest.asset_digest },
      licence.id,
      licence.license_key,
    );
    return deny("ATTESTATION_INVALID", "This build could not be verified.");
  }

  // Monthly bandwidth quota accounting & hard stop check
  if (projectId) {
    try {
      const { accountEgress } = await import("@/lib/project-usage.server");
      const usage = await accountEgress(projectId);
      if (!usage.allowed) {
        await safeViolation("quota_exceeded", { purpose, projectId, usage }, licence.id, licence.license_key);
        return deny("QUOTA_EXCEEDED", "Monthly bandwidth quota exceeded for this project.");
      }
    } catch {
      // Non-blocking fallback if usage tracking fails
    }
  }

  return { ok: true, enforced: true, deviceId: device.id, licenceKey: licence.license_key };
}

/** Violation logging must never be the reason a presign check crashes. */
async function safeViolation(
  kind: string,
  detail: Record<string, unknown>,
  licenseId?: string | null,
  licenceKey?: string,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("license_violations").insert({
      license_id: licenseId ?? null,
      kind,
      detail: { ...detail, ...(licenceKey ? { licenceKey } : {}) },
      ip_address: null,
      origin_host: null,
    });
  } catch {
    /* ignore */
  }
}
