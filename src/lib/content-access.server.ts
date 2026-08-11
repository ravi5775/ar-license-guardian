/**
 * Shared server-only gate for restricted AR content.
 * Never import this from a component — it is `.server.ts` on purpose.
 */
import { getCookie, getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { accessCookieName, verifyAccessCookie } from "@/lib/access.server";

export type ContentKind = "album" | "experience";

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Short-lived media URLs — 15 minutes, never permanent. */
export const MEDIA_URL_TTL_SECONDS = 15 * 60;

export function callerIp() {
  return (
    getRequestIP({ xForwardedFor: true }) ||
    getRequestHeader("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Signed media URLs raise the cost of casual resharing — they die after 15
 * minutes — but they cannot stop a screenshot of an already-opened photo, nor
 * a copy of the file made inside that window. Never describe them as
 * "unshareable" in UI copy.
 */
/**
 * Signs a storage object for delivery.
 *
 * Two modes:
 *  - default (singleUse=false): a plain 15-minute signed URL. This is what
 *    normal gallery viewing uses, because a browser legitimately re-requests
 *    media (reload, seek/range requests, <video> retry) and a one-shot URL
 *    would break all of that.
 *  - singleUse=true: returns a URL to our own /api/public/m/:nonce route. The
 *    nonce is consumed atomically on first GET, then we 302 to a 60-second
 *    signed URL. Opt-in per album/experience via `single_use_media`.
 *
 * Every signing event is logged either way.
 */
export async function signMedia(
  path: string | null | undefined,
  opts?: { singleUse?: boolean; kind?: ContentKind; slug?: string },
) {
  if (!path) return null;

  // §4.7 — presign gating. On a licence-enforced deployment a device with no
  // valid licence state, a released slot or a failed attestation simply never
  // gets a URL, and the bucket has no public read path to fall back on.
  const { checkPresignLicence } = await import("@/lib/adapters/presign-gate.server");
  const gate = await checkPresignLicence("media_fetch");
  if (!gate.ok) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const singleUse = opts?.singleUse === true;

  // Best-effort audit; never block delivery on the log write.
  void supabaseAdmin
    .from("media_signing_events")
    .insert({
      kind: opts?.kind ?? "unknown",
      content_slug: opts?.slug ?? "unknown",
      storage_path: path,
      single_use: singleUse,
      ip: callerIp(),
    })
    .then(() => undefined, () => undefined);

  if (!singleUse) {
    const { data } = await supabaseAdmin.storage
      .from("ar-media")
      .createSignedUrl(path, MEDIA_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  }

  // 32 random bytes; only the SHA-256 is stored, so a DB read cannot replay it.
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await supabaseAdmin.from("media_access_nonces").insert({
    nonce_hash: await sha256Hex(raw),
    storage_path: path,
    kind: opts?.kind ?? "unknown",
    content_slug: opts?.slug ?? "unknown",
    expires_at: new Date(Date.now() + MEDIA_URL_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) return null;
  return `/api/public/m/${raw}`;
}

/**
 * Decides whether the current request may see a piece of content.
 *
 * `public` content is always allowed. `restricted` needs either a valid QR
 * access token or a live 48h session cookie from manual PIN entry.
 *
 * The QR token is verified through the SAME rate-limited database function as
 * manual PIN entry — it is never compared in application code, because doing
 * so would silently bypass the per-IP lockout.
 */
export async function resolveAccess(args: {
  kind: ContentKind;
  slug: string;
  accessMode: string;
  tok?: string | null;
}): Promise<boolean> {
  if (args.accessMode !== "restricted") return true;

  if (args.tok) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = callerIp();
    const { data: allowed } = await supabaseAdmin.rpc("pin_attempts_allowed", {
      _slug: args.slug,
      _ip: ip,
    });
    if (allowed !== false) {
      const { data: result } = await supabaseAdmin.rpc(
        "verify_content_access_token",
        { _kind: args.kind, _slug: args.slug, _token: args.tok },
      );
      if (result === "ok") {
        await supabaseAdmin.rpc("pin_clear_failures", { _slug: args.slug, _ip: ip });
        return true;
      }
      await supabaseAdmin.rpc("pin_record_failure", { _slug: args.slug, _ip: ip });
      await auditPinFailure(args.kind, args.slug, ip);
    }
  }

  const cookie = getCookie(accessCookieName(args.kind, args.slug));
  return verifyAccessCookie(args.slug, cookie);
}

export async function auditPinFailure(kind: ContentKind, slug: string, ip: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_log").insert({
    actor_id: null,
    action: "pin.failed",
    target_type: kind,
    target_id: slug,
    ip_address: ip,
    metadata: { at: new Date().toISOString() },
  });
}
