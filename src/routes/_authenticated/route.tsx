import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTH_CACHE_MS = 30_000;
let cachedAuth: { user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]; isAdmin: boolean; checkedAt: number } | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let user = cachedAuth?.user ?? null;
    let isAdmin = cachedAuth?.isAdmin ?? false;
    if (!cachedAuth || Date.now() - cachedAuth.checkedAt > AUTH_CACHE_MS) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      user = data.user;

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!roleRow;
      cachedAuth = { user, isAdmin, checkedAt: Date.now() };
    }

    if (!user) throw redirect({ to: "/auth" });

    // Skip MFA check while ON the MFA page itself.
    if (location.pathname.startsWith("/mfa")) return { user };

    // Enforce TOTP for admins.
    if (isAdmin) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2";
      if (needsMfa) {
        throw redirect({
          to: "/mfa",
          search: { redirect: location.pathname },
        });
      }
    }

    return { user };
  },
  component: () => <Outlet />,
});
