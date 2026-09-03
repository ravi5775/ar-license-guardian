import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouteContext,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDeploymentProfile } from "@/lib/deployment.functions";
import {
  Sparkles,
  LayoutDashboard,
  Boxes,
  Images,
  Key,
  ShieldCheck,
  LogOut,
  ScrollText,
  BarChart3,
  Target,
  UserCheck,
  FolderOpen,
  Activity,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { features as buildFeatures } from "@/config/features";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const { user, isAdmin } = useRouteContext({ from: "/_authenticated" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setEmail(user?.email ?? "");
  }, [user]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  // Server entitlements further restrict the statically selected build profile.
  const profileFn = useServerFn(getDeploymentProfile);
  const { data: profile } = useQuery({
    queryKey: ["deployment-profile"],
    queryFn: () => profileFn(),
    staleTime: Infinity,
  });
  const features = profile?.features;
  const can = (flag: keyof NonNullable<typeof features>) => {
    if (flag === "licensing" && !buildFeatures.LICENSING_ENABLED) return false;
    if (flag === "analytics" && !buildFeatures.ANALYTICS_ENABLED) return false;
    if (flag === "approvals" && !buildFeatures.ADMIN_ENABLED) return false;
    if (flag === "diagnostics" && !buildFeatures.ADMIN_ENABLED) return false;
    return !features || features[flag];
  };

  const nav = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/dashboard/projects", label: "Projects", icon: FolderOpen },
    { to: "/dashboard/experiences", label: "AR Experiences", icon: Boxes },
    { to: "/dashboard/albums", label: "Albums", icon: Images },
    ...(can("catalog") ? [{ to: "/dashboard/catalogs", label: "Catalogs", icon: Package }] : []),
    ...(can("analytics")
      ? [
          { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
          { to: "/dashboard/marker-tests", label: "Marker Testing", icon: Target },
        ]
      : []),
    ...(isAdmin && can("approvals")
      ? [{ to: "/dashboard/approvals", label: "Approvals", icon: UserCheck }]
      : []),
    ...(isAdmin && can("licensing")
      ? [
          { to: "/dashboard/licenses", label: "Licenses", icon: Key },
          { to: "/dashboard/activations", label: "Activations", icon: ShieldCheck },
        ]
      : []),
    ...(isAdmin && can("diagnostics")
      ? [
          { to: "/dashboard/audit", label: "Audit Log", icon: ScrollText },
          { to: "/dashboard/diagnostics", label: "Diagnostics", icon: Activity },
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
        <div className="p-3 border-t border-border/60">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">{email}</span>
            <span
              className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isAdmin
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              {isAdmin ? "Admin" : "Client"}
            </span>
          </div>
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
