/**
 * Shared server-only gate for restricted AR content.
 * Never import this from a component — it is `.server.ts` on purpose.
 */
import { getCookie, getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { accessCookieName, verifyAccessCookie } from "@/lib/access.server";

export type ContentKind = "album" | "experience";

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
export async function signMedia(path: string | null | undefined) {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("ar-media")
    .createSignedUrl(path, MEDIA_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
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
