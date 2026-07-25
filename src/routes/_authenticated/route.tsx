import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTH_CACHE_MS = 60_000;

type AuthCache = {
  userId: string;
  isAdmin: boolean;
  approval: "pending" | "approved" | "rejected";
  checkedAt: number;
};
let roleCache: AuthCache | null = null;

// Drop the cached role whenever the session changes so a sign-out or
// account switch never reuses the previous user's admin flag.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(() => {
    roleCache = null;
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() reads the locally persisted session (no network round-trip),
    // so navigation between dashboard tabs stays instant.
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (!user) throw redirect({ to: "/auth" });

    let isAdmin = false;
    let approval: "pending" | "approved" | "rejected" = "pending";
    const cached =
      roleCache && roleCache.userId === user.id && Date.now() - roleCache.checkedAt < AUTH_CACHE_MS
        ? roleCache
        : null;

    if (cached) {
      isAdmin = cached.isAdmin;
      approval = cached.approval;
    } else {
      const [{ data: roleRow, error: roleError }, { data: profileRow, error: profileError }] =
        await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("approval_status")
            .eq("id", user.id)
            .maybeSingle(),
        ]);
      // On a transient network/RLS error, fall back to the previous known value
      // instead of silently downgrading an admin to a viewer.
      isAdmin = roleError ? (roleCache?.userId === user.id ? roleCache.isAdmin : false) : !!roleRow;
      approval = profileError
        ? (roleCache?.userId === user.id ? roleCache.approval : "approved")
        : ((profileRow?.approval_status as typeof approval) ?? "pending");
      if (!roleError && !profileError) {
        roleCache = { userId: user.id, isAdmin, approval, checkedAt: Date.now() };
      }
    }

    // Accounts awaiting (or refused) admin approval get the holding page only.
    // Admins are exempt so they can never lock themselves out of the queue.
    if (!isAdmin && approval !== "approved" && !location.pathname.startsWith("/pending")) {
      throw redirect({ to: "/pending" });
    }

    // Skip the MFA check while ON the MFA page itself.
    if (location.pathname.startsWith("/mfa")) return { user, isAdmin, approval };

    // Enforce TOTP for admins that already enrolled a factor.
    if (isAdmin) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2";
      if (needsMfa) {
        throw redirect({ to: "/mfa", search: { redirect: location.pathname } });
      }
    }

    return { user, isAdmin, approval };
  },
  component: () => <Outlet />,
});

