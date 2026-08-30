import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * Authoritative, server-side admin check used by admin-only route guards.
 *
 * The client-side `isAdmin` flag in the `_authenticated` route context is a
 * UI convenience only — it lives in the browser and can be tampered with.
 * Admin pages call this so the role is verified on the server against the
 * caller's own bearer token before the page renders, and every admin server
 * function re-verifies independently.
 *
 * Throws a bare 403 Response (no schema/role detail) for non-admins.
 */
export const assertAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    return { ok: true as const };
  });

/**
 * Surface project bandwidth usage summary in the admin dashboard.
 */
export const getBandwidthUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { getAdminUsageSummary } = await import("@/lib/project-usage.server");
    return await getAdminUsageSummary();
  });
