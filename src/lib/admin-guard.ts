import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side admin gate for server functions.
 *
 * The check runs with the CALLER's own Supabase client (RLS applies), so a
 * user can only ever see their own `user_roles` row — a forged request body
 * or a tampered client bundle cannot promote anybody. Never use the service
 * role client to establish that the caller is an admin.
 *
 * Throws a plain 403 Response so unauthorised callers get a safe, generic
 * error with no schema or role details leaked.
 */
export async function requireAdmin(context: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  claims?: { aal?: string; [key: string]: unknown };
}): Promise<void> {
  if (context.claims?.aal !== "aal2") {
    throw new Response("MFA required", { status: 403 });
  }
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error || !data) {
    throw new Response("Forbidden", { status: 403 });
  }
}

/** Non-throwing variant, for UI that only needs to branch on the role. */
export async function isAdmin(context: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  claims?: { aal?: string; [key: string]: unknown };
}): Promise<boolean> {
  if (context.claims?.aal !== "aal2") return false;
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}
