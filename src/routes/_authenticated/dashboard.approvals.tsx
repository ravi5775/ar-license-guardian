import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";
import { assertAdmin } from "@/lib/admin.functions";
import { listAccounts, decideAccount } from "@/lib/approvals.functions";
import { Check, Clock, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/approvals")({
  beforeLoad: async () => {
    const ok = await assertAdmin().then(() => true).catch(() => false);
    if (!ok) {
      toast.error("You don't have access to account approvals.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ApprovalsPage,
});

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-amber-500/15 text-amber-400",
  rejected: "bg-destructive/15 text-destructive",
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAccounts);
  const decideFn = useServerFn(decideAccount);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const { data: accounts = [], isLoading, error, refetch } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  const decide = useMutation({
    mutationFn: (vars: { userId: string; decision: "approved" | "rejected"; reason?: string }) =>
      decideFn({ data: vars }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      if (vars.decision === "approved") {
        toast.success(
          res?.license?.license_key
            ? `Approved — licence ${res.license.license_key} issued`
            : "Account approved",
        );
      } else {
        toast.success("Account rejected");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the account"),
  });

  const rows = accounts.filter((a: any) =>
    filter === "pending" ? a.approval_status === "pending" : true,
  );
  const pendingCount = accounts.filter((a: any) => a.approval_status === "pending").length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif mb-1">Account approvals</h1>
          <p className="text-sm text-muted-foreground">
            New sign-ups stay locked until you approve them. Approving grants editor access and
            auto-issues that client's licence key.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-400 px-3 py-1 text-xs">
              <Clock className="h-3.5 w-3.5" /> {pendingCount} waiting
            </span>
          )}
          <button
            onClick={() => setFilter(filter === "pending" ? "all" : "pending")}
            className="rounded-full border border-border/60 px-4 py-1.5 text-xs hover:bg-accent"
          >
            {filter === "pending" ? "Show all accounts" : "Show pending only"}
          </button>
        </div>
      </div>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} />

      {!isLoading && !error && (
        <div className="rounded-xl border border-border/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Licence</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {filter === "pending"
                      ? "No accounts waiting for approval."
                      : "No accounts yet."}
                  </td>
                </tr>
              )}
              {rows.map((a: any) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        STATUS_STYLES[a.approval_status] ?? ""
                      }`}
                    >
                      {a.approval_status}
                    </span>
                    {a.approval_status === "rejected" && a.rejection_reason && (
                      <div className="mt-1 text-xs text-muted-foreground">{a.rejection_reason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.license ? (
                      <div>
                        <code className="text-xs">{a.license.license_key}</code>
                        <div className="text-xs text-muted-foreground">{a.license.status}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {a.approval_status !== "approved" && (
                        <button
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ userId: a.id, decision: "approved" })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {a.approval_status !== "rejected" && (
                        <button
                          disabled={decide.isPending}
                          onClick={() => {
                            const reason =
                              window.prompt("Reason for rejection (shown to the user):") ?? "";
                            decide.mutate({ userId: a.id, decision: "rejected", reason });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
