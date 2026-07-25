import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listActivations, revokeActivation } from "@/lib/licenses.functions";
import { assertAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";
import { ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/activations")({
  beforeLoad: async () => {
    const ok = await assertAdmin().then(() => true).catch(() => false);
    if (!ok) {
      toast.error("You don't have access to device activations.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ActivationsPage,
});


function ActivationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listActivations);
  const revokeFn = useServerFn(revokeActivation);
  const { data: activations = [], isLoading, error, refetch } = useQuery({
    queryKey: ["activations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activations"] });
      toast.success("Revoked");
    },
  });

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-serif italic mb-1">Activations</h1>
      <p className="text-sm text-muted-foreground mb-8">Deployment instances that have activated a license.</p>

      <QueryState isLoading={isLoading} error={error} onRetry={() => refetch()} label="activations" />

      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Client / License</th>
              <th className="text-left px-4 py-3">Deployment</th>
              <th className="text-left px-4 py-3">Fingerprint</th>
              <th className="text-left px-4 py-3">Last seen</th>
              <th className="text-left px-4 py-3">Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {activations.map((a: any) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <div>{a.licenses?.client_name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{a.licenses?.license_key}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{a.deployment_domain || "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.deployment_platform}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{a.fingerprint.slice(0, 16)}…</td>
                <td className="px-4 py-3 text-xs">{new Date(a.last_seen_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {a.revoked_at ? (
                    <span className="text-xs text-destructive">Revoked</span>
                  ) : (
                    <span className="text-xs text-primary">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!a.revoked_at && (
                    <button
                      onClick={() => confirm("Revoke this activation?") && revokeMut.mutate(a.id)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-destructive/10 text-destructive"
                    >
                      <ShieldOff className="h-3 w-3" /> Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {activations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No activations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
