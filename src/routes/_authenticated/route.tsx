import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSessionContext, type SessionContext } from "@/lib/session.functions";
import { logGateEvent } from "@/lib/diagnostics.functions";

/** Fire-and-forget: diagnostics must never delay or break the gate. */
function logGate(data: {
  path: string;
  decision: "allow" | "redirect" | "deny";
  reason: string;
  isAdmin?: boolean;
  approval?: string | null;
}) {
  void logGateEvent({ data }).catch(() => {});
}

const AUTH_CACHE_MS = 60_000;

type AuthCache = SessionContext & { checkedAt: number };
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
    if (!user) {
      logGate({ path: location.pathname, decision: "redirect", reason: "no_session" });
      throw redirect({ to: "/auth" });
    }

    const cached =
      roleCache && roleCache.userId === user.id && Date.now() - roleCache.checkedAt < AUTH_CACHE_MS
        ? roleCache
        : null;

    let session: SessionContext;
    if (cached) {
      session = cached;
    } else {
      try {
        // Role + approval are resolved by a server function, never by a
        // direct table read from the browser.
        session = await getSessionContext();
        roleCache = { ...session, checkedAt: Date.now() };
      } catch {
        // On a transient network error, fall back to the previous known value
        // instead of silently downgrading an admin to a viewer.
        session =
          roleCache?.userId === user.id
            ? roleCache
            : { userId: user.id, email: user.email ?? null, isAdmin: false, approval: "approved" };
      }
    }

    const { isAdmin, approval } = session;

    // Accounts awaiting (or refused) admin approval get the holding page only.
    // Admins are exempt so they can never lock themselves out of the queue.
    if (!isAdmin && approval !== "approved" && !location.pathname.startsWith("/pending")) {
      logGate({
        path: location.pathname,
        decision: "redirect",
        reason: `approval_${approval}`,
        isAdmin,
        approval,
      });
      throw redirect({ to: "/pending" });
    }

    // Skip the MFA check while ON the MFA page itself.
    if (location.pathname.startsWith("/mfa")) return { user, isAdmin, approval };

    // Enforce TOTP for admins that already enrolled a factor.
    if (isAdmin) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2";
      if (needsMfa) {
        logGate({
          path: location.pathname,
          decision: "redirect",
          reason: "mfa_step_up_required",
          isAdmin,
          approval,
        });
        throw redirect({ to: "/mfa", search: { redirect: location.pathname } });
      }
    }

    return { user, isAdmin, approval };
  },
  component: () => <Outlet />,
});

