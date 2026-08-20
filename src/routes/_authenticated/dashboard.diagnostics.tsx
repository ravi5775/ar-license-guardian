import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listGateEvents } from "@/lib/diagnostics.functions";
import { assertAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";

export const Route = createFileRoute("/_authenticated/dashboard/diagnostics")({
  beforeLoad: async () => {
    const ok = await assertAdmin()
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      toast.error("You don't have access to diagnostics.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: DiagnosticsPage,
});

const decisionStyle: Record<string, string> = {
  allow: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  redirect: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  deny: "border-destructive/40 bg-destructive/10 text-destructive",
};

function DiagnosticsPage() {
  const fn = useServerFn(listGateEvents);
  const {
    data: rows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["gate-events"],
    queryFn: () => fn(),
    staleTime: 15_000,
  });

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-serif italic mb-1">Diagnostics</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Access-gate decisions and redirect reasons across this deployment (latest 200).
      </p>

      <QueryState
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        label="gate events"
      />

      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">When</th>
              <th className="text-left px-4 py-3">Decision</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Path</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Build</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      decisionStyle[r.decision] ?? "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {r.decision}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.reason}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.path}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {r.user_id ? r.user_id.slice(0, 8) : "anon"}
                  {r.is_admin ? " · admin" : ""}
                  {r.approval ? ` · ${r.approval}` : ""}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.deployment_role}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No gate events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
