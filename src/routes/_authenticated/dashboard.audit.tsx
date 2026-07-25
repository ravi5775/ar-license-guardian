import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAuditLog } from "@/lib/licenses.functions";
import { assertAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";

export const Route = createFileRoute("/_authenticated/dashboard/audit")({
  beforeLoad: async () => {
    const ok = await assertAdmin().then(() => true).catch(() => false);
    if (!ok) {
      toast.error("You don't have access to the audit log.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuditPage,
});


function AuditPage() {
  const fn = useServerFn(listAuditLog);
  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ["audit"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-serif italic mb-1">Audit log</h1>
      <p className="text-sm text-muted-foreground mb-8">Recent admin actions across the platform.</p>

      <QueryState isLoading={isLoading} error={error} onRetry={() => refetch()} label="audit log" />

      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">When</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Target</th>
              <th className="text-left px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-3 text-xs">
                  {r.target_type} <span className="text-muted-foreground">{r.target_id?.slice(0, 8)}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {r.metadata ? JSON.stringify(r.metadata) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
