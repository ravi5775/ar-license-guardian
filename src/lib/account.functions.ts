import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Self-scoped account read (own profile + own licence, if the deployment has
 * a licences table at all).
 *
 * This lives outside `approvals.functions.ts` on purpose: the approvals module
 * is admin/issuer-only and is stripped from customer (client-app) deliveries,
 * but the holding page at /pending still has to work there.
 */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, email, approval_status, approval_decided_at, rejection_reason")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Client-app builds have no licences table; a failure here is not fatal.
    let license: unknown = null;
    try {
      const { data } = await context.supabase
        .from("licenses")
        .select("license_key, plan, status, max_activations, issued_at, expires_at")
        .eq("owner_user_id", context.userId)
        .maybeSingle();
      license = data ?? null;
    } catch {
      license = null;
    }

    return { profile: profile ?? null, license: license as Record<string, any> | null };
  });
