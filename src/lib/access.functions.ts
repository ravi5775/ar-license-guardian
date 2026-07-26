import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setCookie } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Kind = z.enum(["album", "experience"]);

/* ------------------------------------------------------------------ */
/* Public: manual PIN entry                                            */
/* ------------------------------------------------------------------ */

/**
 * Checks a 4-character PIN against the bcrypt hash held in Postgres.
 * Rate limited to 5 failures/hour/IP with a 15-minute lockout per slug,
 * and every failure is written to the audit log. The response never
 * discloses attempt counts or lockout timing.
 */
export const submitAccessPin = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        kind: Kind,
        slug: z.string().min(1).max(120),
        pin: z.string().min(1).max(16),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const {
      callerIp,
      auditPinFailure,
    } = await import("@/lib/content-access.server");
    const {
      accessCookieName,
      signAccessCookie,
      ACCESS_COOKIE_MAX_AGE,
    } = await import("@/lib/access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip = callerIp();

    const { data: allowed } = await supabaseAdmin.rpc("pin_attempts_allowed", {
      _slug: data.slug,
      _ip: ip,
    });
    if (allowed === false) {
      return { ok: false as const, message: "Incorrect PIN." };
    }

    const { data: valid } = await supabaseAdmin.rpc("verify_content_pin", {
      _kind: data.kind,
      _slug: data.slug,
      _pin: data.pin,
    });

    if (valid !== true) {
      await supabaseAdmin.rpc("pin_record_failure", { _slug: data.slug, _ip: ip });
      await auditPinFailure(data.kind, data.slug, ip);
      return { ok: false as const, message: "Incorrect PIN." };
    }

    await supabaseAdmin.rpc("pin_clear_failures", { _slug: data.slug, _ip: ip });

    const expiresAt = Date.now() + ACCESS_COOKIE_MAX_AGE * 1000;
    setCookie(accessCookieName(data.kind, data.slug), await signAccessCookie(data.slug, expiresAt), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Admin/owner: read + rotate the PIN                                  */
/* ------------------------------------------------------------------ */

async function loadOwnedRow(
  supabase: any,
  kind: "album" | "experience",
  id: string,
) {
  const table = kind === "album" ? "albums" : "ar_experiences";
  const { data, error } = await supabase
    .from(table)
    .select("id, slug, title, access_mode, pin_encrypted")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
  return data;
}

/** Everything the admin needs to print a QR: slug, plaintext PIN, signed token. */
export const getShareCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ kind: Kind, id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const row = await loadOwnedRow(context.supabase, data.kind, data.id);
    if (row.access_mode !== "restricted") {
      return { slug: row.slug, title: row.title, restricted: false as const, pin: null, tok: null };
    }
    const { decryptPin, deriveQrToken } = await import("@/lib/access.server");
    const pin = await decryptPin(row.pin_encrypted);
    return {
      slug: row.slug,
      title: row.title,
      restricted: true as const,
      pin,
      tok: pin ? await deriveQrToken(row.slug, pin) : null,
    };
  });

/**
 * Switches content between public and restricted.
 * Going restricted mints a fresh 12-16 char slug and a fresh PIN, so the old
 * public URL stops resolving. Going public wipes the PIN material entirely.
 */
export const setAccessMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ kind: Kind, id: z.string().uuid(), mode: z.enum(["public", "restricted"]) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const row = await loadOwnedRow(context.supabase, data.kind, data.id);
    const table = data.kind === "album" ? "albums" : "ar_experiences";

    if (data.mode === "public") {
      const { error } = await context.supabase
        .from(table)
        .update({ access_mode: "public", pin_hash: null, pin_encrypted: null, pin_updated_at: null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { slug: row.slug, pin: null, tok: null, restricted: false as const };
    }

    const { generateRestrictedSlug, generatePin, encryptPin, deriveQrToken } =
      await import("@/lib/access.server");
    const slug = generateRestrictedSlug();
    const pin = generatePin();

    const { error } = await context.supabase
      .from(table)
      .update({ access_mode: "restricted", slug, show_in_gallery: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pinErr } = await supabaseAdmin.rpc("set_content_pin", {
      _kind: data.kind,
      _id: data.id,
      _pin: pin,
      _pin_encrypted: await encryptPin(pin),
    });
    if (pinErr) throw new Error(pinErr.message);

    return { slug, pin, tok: await deriveQrToken(slug, pin), restricted: true as const };
  });

/** Rotates the PIN — every previously printed QR token stops verifying. */
export const regeneratePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ kind: Kind, id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const row = await loadOwnedRow(context.supabase, data.kind, data.id);
    if (row.access_mode !== "restricted") throw new Error("Content is not restricted");

    const { generatePin, encryptPin, deriveQrToken } = await import("@/lib/access.server");
    const pin = generatePin();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_content_pin", {
      _kind: data.kind,
      _id: data.id,
      _pin: pin,
      _pin_encrypted: await encryptPin(pin),
    });
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: "pin.regenerated",
      target_type: data.kind,
      target_id: row.slug,
    });

    return { slug: row.slug, pin, tok: await deriveQrToken(row.slug, pin), restricted: true as const };
  });
