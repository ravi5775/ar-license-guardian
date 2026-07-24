import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTH_CACHE_MS = 60_000;

type AuthCache = { userId: string; isAdmin: boolean; checkedAt: number };
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
    if (roleCache && roleCache.userId === user.id && Date.now() - roleCache.checkedAt < AUTH_CACHE_MS) {
      isAdmin = roleCache.isAdmin;
    } else {
      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      // On a transient network/RLS error, fall back to the previous known value
      // instead of silently downgrading an admin to a viewer.
      isAdmin = roleError ? (roleCache?.userId === user.id ? roleCache.isAdmin : false) : !!roleRow;
      if (!roleError) roleCache = { userId: user.id, isAdmin, checkedAt: Date.now() };
    }

    // Skip the MFA check while ON the MFA page itself.
    if (location.pathname.startsWith("/mfa")) return { user, isAdmin };

    // Enforce TOTP for admins that already enrolled a factor.
    if (isAdmin) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2";
      if (needsMfa) {
        throw redirect({ to: "/mfa", search: { redirect: location.pathname } });
      }
    }

    return { user, isAdmin };
  },
  component: () => <Outlet />,
});
