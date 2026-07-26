/**
 * Shared server-only gate for restricted AR content.
 * Never import this from a component — it is `.server.ts` on purpose.
 */
import { getCookie, getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import {
  accessCookieName,
  verifyAccessCookie,
  verifyQrToken,
  decryptPin,
} from "@/lib/access.server";

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
 * `public` content is always allowed; `restricted` needs either a valid
 * QR-embedded HMAC token or a live 48h session cookie from manual PIN entry.
 */
export async function resolveAccess(args: {
  kind: ContentKind;
  slug: string;
  accessMode: string;
  pinEncrypted: string | null;
  tok?: string | null;
}): Promise<boolean> {
  if (args.accessMode !== "restricted") return true;

  if (args.tok) {
    const pin = await decryptPin(args.pinEncrypted);
    if (pin && (await verifyQrToken(args.slug, pin, args.tok))) return true;
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
