import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SessionContext = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  approval: "pending" | "approved" | "rejected";
};

/**
 * Single source of truth for the signed-in user's role + approval state.
 *
 * The frontend must never query `user_roles` / `profiles` directly: the
 * lookups run here, on the server, with the caller's own Supabase client
 * (RLS applies), and only the resolved flags cross the wire.
 */
export const getSessionContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionContext> => {
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    return {
      userId: context.userId,
      email: (context.claims as { email?: string } | null)?.email ?? null,
      isAdmin: !!roleRow,
      approval:
        (profileRow?.approval_status as SessionContext["approval"]) ?? "pending",
    };
  });
