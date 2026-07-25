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
}): Promise<void> {
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
}): Promise<boolean> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}
