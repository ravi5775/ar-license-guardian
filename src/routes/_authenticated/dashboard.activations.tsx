import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listActivations,
  revokeActivation,
  forceReleaseActivation,
} from "@/lib/licenses.functions";
import { assertAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";
import { ShieldOff, Unlock, X, ScrollText } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/activations")({
  beforeLoad: async () => {
    const ok = await assertAdmin()
      .then(() => true)
      .catch(() => false);
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
  const {
    data: activations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["activations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const releaseFn = useServerFn(forceReleaseActivation);
  const [target, setTarget] = useState<any | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [lastEntry, setLastEntry] = useState<any | null>(null);

  const releaseMut = useMutation({
    mutationFn: () => releaseFn({ data: { id: target.id, password, reason: reason || undefined } }),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ["activations"] });
      setLastEntry(entry);
      setTarget(null);
      setPassword("");
      setReason("");
      toast.success("Device slot released — cooldown cleared.");
    },
    onError: (e: Error) => toast.error(e.message),
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
      <p className="text-sm text-muted-foreground mb-8">
        Deployment instances that have activated a license.
      </p>

      <QueryState
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        label="activations"
      />

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
                  <div className="text-xs font-mono text-muted-foreground">
                    {a.licenses?.license_key}
                  </div>
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
                  <div className="flex items-center gap-2">
                    {!a.revoked_at && (
                      <button
                        onClick={() => confirm("Revoke this activation?") && revokeMut.mutate(a.id)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-destructive/10 text-destructive"
                      >
                        <ShieldOff className="h-3 w-3" /> Revoke
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setTarget(a);
                        setPassword("");
                        setReason("");
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted"
                      title="Free this slot immediately and clear the 12h cooldown"
                    >
                      <Unlock className="h-3 w-3" /> Force release
                    </button>
                  </div>
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

      {lastEntry && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <ScrollText className="h-4 w-4 text-primary" /> Audit entry recorded
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <dt>Action</dt>
            <dd className="font-mono text-foreground">{lastEntry.action}</dd>
            <dt>Activation</dt>
            <dd className="font-mono">{lastEntry.target_id}</dd>
            <dt>When</dt>
            <dd>{new Date(lastEntry.created_at).toLocaleString()}</dd>
            <dt>Details</dt>
            <dd className="font-mono break-all">{JSON.stringify(lastEntry.metadata)}</dd>
          </dl>
        </div>
      )}

      {target && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-serif italic">Force-release device</h2>
              <button onClick={() => setTarget(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This frees the {target.device_class} slot on{" "}
              <span className="text-foreground">{target.licenses?.client_name}</span> straight away
              and skips the 12-hour cooldown. Confirm with your password.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                releaseMut.mutate();
              }}
              className="space-y-3"
            >
              <input
                required
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder="Reason (kept in the audit log)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                disabled={releaseMut.isPending}
                className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {releaseMut.isPending ? "Releasing…" : "Confirm release"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
