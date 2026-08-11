import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/admin-guard";


function generateKey() {
  const seg = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return `AETH-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export const listLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("licenses")
      .select("*, license_activations(count)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listActivations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("license_activations")
      .select("*, licenses(license_key, client_name)")
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        client_name: z.string().min(1),
        client_email: z.string().email(),
        plan: z.enum(["starter", "pro", "enterprise"]),
        max_activations: z.number().int().min(1).max(50),
        expires_at: z.string().datetime().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: row, error } = await context.supabase
      .from("licenses")
      .insert({ ...data, license_key: generateKey() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: "license.create",
      target_type: "license",
      target_id: row.id,
      metadata: { client: data.client_name, plan: data.plan },
    });
    return row;
  });

export const revokeActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("license_activations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: "activation.revoke",
      target_type: "activation",
      target_id: data.id,
    });
    return { ok: true };
  });

export const setLicenseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "suspended", "revoked", "expired"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("licenses")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: "license.status",
      target_type: "license",
      target_id: data.id,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Admin force-release of a device slot (§4.4 override).
 *
 * Two gates, both server-side:
 *   1. the caller must be an admin under their own RLS-scoped client, and
 *   2. step-up re-auth — they re-enter their password, which we verify against
 *      Supabase Auth in a throwaway session. A stolen open tab therefore
 *      cannot evict a client's live device.
 *
 * Clears the 12h cooldown so the customer can activate immediately, and
 * returns the audit entry it wrote so the UI can show exactly what was logged.
 */
export const forceReleaseActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        password: z.string().min(1).max(200),
        reason: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) throw new Error("Re-authentication unavailable for this account.");

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const stepUp = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error: reauthError } = await stepUp.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (reauthError) {
      await context.supabase.from("audit_log").insert({
        actor_id: context.userId,
        action: "activation.force_release.denied",
        target_type: "activation",
        target_id: data.id,
        metadata: { reason: "reauth_failed" },
      });
      throw new Error("Password incorrect — the device was not released.");
    }
    await stepUp.auth.signOut();

    const { adminForceRelease } = await import("@/lib/adapters/licence.server");
    await adminForceRelease(data.id);

    const { data: entry, error } = await context.supabase
      .from("audit_log")
      .insert({
        actor_id: context.userId,
        action: "activation.force_release",
        target_type: "activation",
        target_id: data.id,
        metadata: {
          cooldown_cleared: true,
          reason: data.reason ?? null,
          by: email,
        },
      })
      .select("id, action, created_at, metadata, target_id")
      .single();
    if (error) throw new Error(error.message);
    return entry;
  });
