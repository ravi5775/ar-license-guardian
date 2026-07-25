import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * Account approval queue.
 *
 * New sign-ups land as `pending` (see the `handle_new_user` trigger) and
 * cannot create AR content until an admin approves them. Approving also
 * grants the `editor` role and auto-issues that client's licence key —
 * both handled by the `profiles_apply_approval` database trigger, so the
 * licence can never drift out of sync with the approval state.
 */

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "id, display_name, email, approval_status, approval_decided_at, rejection_reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p) => p.id);
    const licensesById = new Map<string, { license_key: string; status: string }>();
    if (ids.length) {
      const { data: licenses } = await context.supabase
        .from("licenses")
        .select("owner_user_id, license_key, status")
        .in("owner_user_id", ids);
      for (const l of licenses ?? []) {
        if (l.owner_user_id) {
          licensesById.set(l.owner_user_id, { license_key: l.license_key, status: l.status });
        }
      }
    }

    return (data ?? []).map((p) => ({ ...p, license: licensesById.get(p.id) ?? null }));
  });

export const decideAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        userId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "pending"]),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    if (data.userId === context.userId) {
      throw new Error("You cannot change your own approval status");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({
        approval_status: data.decision,
        approval_decided_at: new Date().toISOString(),
        approved_by: context.userId,
        rejection_reason: data.decision === "rejected" ? (data.reason ?? null) : null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: `account.${data.decision}`,
      target_type: "profile",
      target_id: data.userId,
      metadata: { reason: data.reason ?? null },
    });

    const { data: license } = await context.supabase
      .from("licenses")
      .select("license_key, status")
      .eq("owner_user_id", data.userId)
      .maybeSingle();

    return { ok: true, license: license ?? null };
  });

/** The signed-in user's own approval state + auto-issued licence. */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, email, approval_status, approval_decided_at, rejection_reason")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: license } = await context.supabase
      .from("licenses")
      .select("license_key, plan, status, max_activations, issued_at, expires_at")
      .eq("owner_user_id", context.userId)
      .maybeSingle();

    return { profile: profile ?? null, license: license ?? null };
  });
