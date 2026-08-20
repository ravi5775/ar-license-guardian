import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setCookie } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Kind = z.enum(["album", "experience"]);

/** Default PIN lifetime. Rotate before this and reprint the card. */
const PIN_TTL_DAYS = 180;
/** QR access tokens outlive PINs — they are cheap to revoke individually. */
const TOKEN_TTL_DAYS = 365;

/* ------------------------------------------------------------------ */
/* Public: manual PIN entry                                            */
/* ------------------------------------------------------------------ */

/**
 * Checks a PIN against the bcrypt hash held in Postgres. Nothing reversible
 * is stored, so even we cannot read a PIN back after it is issued.
 *
 * Rate limited to 5 failures/hour/IP with a 15-minute lockout per slug, and
 * every failure is written to the audit log. The response never discloses
 * attempt counts or lockout timing — except for an expired PIN, where a
 * generic "incorrect" would send the customer down the wrong path.
 */
export const submitAccessPin = createServerFn({ method: "POST" })
  .validator((raw) =>
    z
      .object({
        kind: Kind,
        slug: z.string().min(1).max(120),
        pin: z.string().min(1).max(32),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { callerIp, auditPinFailure } = await import("@/lib/content-access.server");
    const { accessCookieName, signAccessCookie, ACCESS_COOKIE_MAX_AGE } =
      await import("@/lib/access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip = callerIp();

    const { data: allowed } = await supabaseAdmin.rpc("pin_attempts_allowed", {
      _slug: data.slug,
      _ip: ip,
    });
    if (allowed === false) {
      return { ok: false as const, reason: "invalid" as const, message: "Incorrect PIN." };
    }

    const { data: result } = await supabaseAdmin.rpc("verify_content_pin", {
      _kind: data.kind,
      _slug: data.slug,
      _pin: data.pin,
    });

    if (result !== "ok") {
      await supabaseAdmin.rpc("pin_record_failure", { _slug: data.slug, _ip: ip });
      await auditPinFailure(data.kind, data.slug, ip);
      if (result === "pin_expired") {
        return {
          ok: false as const,
          reason: "pin_expired" as const,
          message: "This PIN has expired. Ask for a new card or a fresh link.",
        };
      }
      return { ok: false as const, reason: "invalid" as const, message: "Incorrect PIN." };
    }

    await supabaseAdmin.rpc("pin_clear_failures", { _slug: data.slug, _ip: ip });

    const expiresAt = Date.now() + ACCESS_COOKIE_MAX_AGE * 1000;
    setCookie(
      accessCookieName(data.kind, data.slug),
      await signAccessCookie(data.slug, expiresAt),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_COOKIE_MAX_AGE,
      },
    );

    return { ok: true as const, reason: "ok" as const };
  });

/* ------------------------------------------------------------------ */
/* Admin/owner: issue + rotate credentials                             */
/* ------------------------------------------------------------------ */

async function loadOwnedRow(
  supabase: any,
  kind: "album" | "experience",
  id: string,
) {
  const table = kind === "album" ? "albums" : "ar_experiences";
  const { data, error } = await supabase
    .from(table)
    .select("id, slug, title, access_mode, pin_created_at, pin_expires_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
  return data;
}

/** Mints a fresh PIN + QR access token for a row the caller owns. */
async function issueCredentials(kind: "album" | "experience", id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // PIN is generated in Postgres with gen_random_bytes + rejection sampling.
  const { data: pin, error: genErr } = await supabaseAdmin.rpc("generate_content_pin", {
    _length: 6,
  });
  if (genErr) throw new Error(genErr.message);

  const { data: pinExpires, error: setErr } = await supabaseAdmin.rpc("set_content_pin", {
    _kind: kind,
    _id: id,
    _pin: pin as string,
    _ttl_days: PIN_TTL_DAYS,
  });
  if (setErr) throw new Error(setErr.message);

  // Old printed QR codes stop working the moment credentials are re-issued.
  await supabaseAdmin.rpc("revoke_content_access_tokens", {
    _kind: kind,
    _content_id: id,
  });

  const { data: tok, error: tokErr } = await supabaseAdmin.rpc(
    "issue_content_access_token",
    { _kind: kind, _content_id: id, _ttl_days: TOKEN_TTL_DAYS, _label: "printed-qr" },
  );
  if (tokErr) throw new Error(tokErr.message);

  return { pin: pin as string, tok: tok as string, pinExpiresAt: pinExpires as string };
}

/**
 * Share state for the owner. The PIN is NOT returned here — it only exists in
 * plaintext at the moment it is issued. Reprinting requires re-issuing.
 */
export const getShareCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ kind: Kind, id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const row = await loadOwnedRow(context.supabase, data.kind, data.id);
    return {
      slug: row.slug as string,
      title: row.title as string,
      restricted: row.access_mode === "restricted",
      pin: null as string | null,
      tok: null as string | null,
      pinExpiresAt: (row.pin_expires_at ?? null) as string | null,
    };
  });

/**
 * Switches content between public and restricted.
 * Going restricted mints a fresh 12-16 char slug, a fresh PIN and a fresh QR
 * token, so the old public URL stops resolving. Going public wipes the PIN
 * and revokes every outstanding QR token.
 */
export const setAccessMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({ kind: Kind, id: z.string().uuid(), mode: z.enum(["public", "restricted"]) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const row = await loadOwnedRow(context.supabase, data.kind, data.id);
    const table = data.kind === "album" ? "albums" : "ar_experiences";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.mode === "public") {
      const { error } = await context.supabase
        .from(table)
        .update({
          access_mode: "public",
          pin_hash: null,
          pin_created_at: null,
          pin_expires_at: null,
          pin_updated_at: null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.rpc("revoke_content_access_tokens", {
        _kind: data.kind,
        _content_id: data.id,
      });
      return {
        slug: row.slug as string,
        pin: null,
        tok: null,
        pinExpiresAt: null,
        restricted: false as const,
      };
    }

    const { generateRestrictedSlug } = await import("@/lib/access.server");
    const slug = generateRestrictedSlug();

    const { error } = await context.supabase
      .from(table)
      .update({ access_mode: "restricted", slug, show_in_gallery: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const issued = await issueCredentials(data.kind, data.id);
    return { slug, ...issued, restricted: true as const };
  });

/**
 * Rotates the PIN and the QR token together — every previously printed card
 * stops working immediately. This is also the only way to see a PIN again,
 * because nothing reversible is stored.
 */
export const regeneratePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ kind: Kind, id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const row = await loadOwnedRow(context.supabase, data.kind, data.id);
    if (row.access_mode !== "restricted") throw new Error("Content is not restricted");

    const issued = await issueCredentials(data.kind, data.id);

    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: "pin.regenerated",
      target_type: data.kind,
      target_id: row.slug,
    });

    return { slug: row.slug as string, ...issued, restricted: true as const };
  });
