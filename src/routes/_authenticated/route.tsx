import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Skip MFA check while ON the MFA page itself.
    if (location.pathname.startsWith("/mfa")) return { user: data.user };

    // Enforce TOTP for admins.
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleRow) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2";
      if (needsMfa) {
        throw redirect({
          to: "/mfa",
          search: { redirect: location.pathname },
        });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
