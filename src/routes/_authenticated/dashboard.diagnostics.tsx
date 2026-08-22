import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listGateEvents, listDeviceTelemetry } from "@/lib/diagnostics.functions";
import { getBandwidthUsageSummary, assertAdmin } from "@/lib/admin.functions";
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

const tierStyle: Record<string, string> = {
  high: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  standard: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  lite: "border-amber-500/40 bg-amber-500/10 text-amber-400",
};

function DiagnosticsPage() {
  const gateFn = useServerFn(listGateEvents);
  const telemetryFn = useServerFn(listDeviceTelemetry);
  const bandwidthFn = useServerFn(getBandwidthUsageSummary);

  const {
    data: gateRows = [],
    isLoading: gateLoading,
    error: gateError,
    refetch: refetchGate,
  } = useQuery({
    queryKey: ["gate-events"],
    queryFn: () => gateFn(),
    staleTime: 15_000,
  });

  const {
    data: telemetryRows = [],
    isLoading: telemetryLoading,
    error: telemetryError,
  } = useQuery({
    queryKey: ["device-telemetry"],
    queryFn: () => telemetryFn(),
    staleTime: 15_000,
  });

  const {
    data: bandwidthRows = [],
    isLoading: bandwidthLoading,
    error: bandwidthError,
  } = useQuery({
    queryKey: ["bandwidth-usage-summary"],
    queryFn: () => bandwidthFn(),
    staleTime: 30_000,
  });

  return (
    <div className="p-8 max-w-6xl space-y-10">
      <div>
        <h1 className="text-3xl font-serif italic mb-1">System Diagnostics & Telemetry</h1>
        <p className="text-sm text-muted-foreground">
          Real-time visibility into gate decisions, client device AR capability tiers, and monthly egress quotas.
        </p>
      </div>

      {/* Section 1: Monthly Egress & Bandwidth Caps */}
      <div className="space-y-4">
        <h2 className="text-xl font-medium">Monthly Project Bandwidth & Quota Usage</h2>
        <QueryState
          isLoading={bandwidthLoading}
          error={bandwidthError}
          label="bandwidth usage"
        />
        <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Month</th>
                <th className="text-left px-4 py-3">Egress Used</th>
                <th className="text-left px-4 py-3">Quota Cap</th>
                <th className="text-left px-4 py-3">Utilization</th>
                <th className="text-left px-4 py-3">Requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {bandwidthRows.map((b: any) => (
                <tr key={`${b.projectId}-${b.monthYear}`}>
                  <td className="px-4 py-3 font-medium">{b.projectTitle}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.monthYear}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.usedGB} GB</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.capGB} GB</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted/40 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            Number(b.percentUsed) >= 80 ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(Number(b.percentUsed), 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{b.percentUsed}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{b.totalRequests}</td>
                </tr>
              ))}
              {bandwidthRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No egress records for the current billing cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Real-Device AR Capability Telemetry */}
      <div className="space-y-4">
        <h2 className="text-xl font-medium">Active Devices & AR Capability Tiers</h2>
        <QueryState
          isLoading={telemetryLoading}
          error={telemetryError}
          label="device telemetry"
        />
        <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Last Seen</th>
                <th className="text-left px-4 py-3">Class</th>
                <th className="text-left px-4 py-3">AR Tier</th>
                <th className="text-left px-4 py-3">Origin Host</th>
                <th className="text-left px-4 py-3">Build ID</th>
                <th className="text-left px-4 py-3">Licence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {telemetryRows.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(d.last_seen_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">{d.device_class}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        tierStyle[d.capability_tier ?? ""] ?? "border-border/60 text-muted-foreground"
                      }`}
                    >
                      {d.capability_tier ?? "standard"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{d.origin_host ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                    {d.build_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                    {d.license_key}
                  </td>
                </tr>
              ))}
              {telemetryRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No active devices reporting telemetry yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Auth & Access Gate Events */}
      <div className="space-y-4">
        <h2 className="text-xl font-medium">Auth & Access Gate Log</h2>
        <QueryState
          isLoading={gateLoading}
          error={gateError}
          onRetry={() => refetchGate()}
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
              {gateRows.map((r) => (
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
              {gateRows.length === 0 && (
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
    </div>
  );
}
