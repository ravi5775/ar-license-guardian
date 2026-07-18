import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/experiences.functions";
import { Sparkles, LayoutDashboard, Boxes, Key, ShieldCheck, LogOut, ScrollText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const rolesFn = useServerFn(getMyRoles);
  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = roles.includes("admin");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  const nav = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/dashboard/experiences", label: "AR Experiences", icon: Boxes },
    ...(isAdmin
      ? [
          { to: "/dashboard/licenses", label: "Licenses", icon: Key },
          { to: "/dashboard/activations", label: "Activations", icon: ShieldCheck },
          { to: "/dashboard/audit", label: "Audit Log", icon: ScrollText },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground grid grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[240px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-border/60 bg-card/20 backdrop-blur-xl flex flex-col md:min-h-screen">
        <Link to="/" className="flex items-center gap-2 px-6 h-16 border-b border-border/60">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-serif italic">Aether AR</span>
        </Link>
        <nav className="flex p-2 gap-1 overflow-x-auto md:flex-1 md:p-3 md:space-y-1 md:block">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                preload="intent"
                className={`flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block p-3 border-t border-border/60">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
