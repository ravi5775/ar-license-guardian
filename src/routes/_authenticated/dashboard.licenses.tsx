import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listLicenses, createLicense, setLicenseStatus } from "@/lib/licenses.functions";
import { assertAdmin } from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";
import { Plus, Copy, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/licenses")({
  // Server-verified admin gate: the browser-side role flag is never trusted.
  beforeLoad: async () => {
    const ok = await assertAdmin().then(() => true).catch(() => false);
    if (!ok) {
      toast.error("You don't have access to licence management.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LicensesPage,
});


function LicensesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listLicenses);
  const createFn = useServerFn(createLicense);
  const statusFn = useServerFn(setLicenseStatus);
  const { data: licenses = [], isLoading, error, refetch } = useQuery({
    queryKey: ["licenses"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    plan: "starter" as "starter" | "pro" | "enterprise",
    max_activations: 1,
    notes: "",
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      toast.success(`License issued: ${row.license_key}`);
      setOpen(false);
      setForm({ client_name: "", client_email: "", plan: "starter", max_activations: 1, notes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: any }) => statusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }),
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif italic">Licenses</h1>
          <p className="text-sm text-muted-foreground">Issue and manage deployment licenses.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Issue license
        </button>
      </div>

      <div className="mb-6 empty:mb-0">
        <QueryState isLoading={isLoading} error={error} onRetry={() => refetch()} label="licenses" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Key</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Activations</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {licenses.map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  <button
                    className="hover:text-primary inline-flex items-center gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(l.license_key);
                      toast.success("Copied");
                    }}
                  >
                    {l.license_key} <Copy className="h-3 w-3" />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div>{l.client_name}</div>
                  <div className="text-xs text-muted-foreground">{l.client_email}</div>
                </td>
                <td className="px-4 py-3 capitalize">{l.plan}</td>
                <td className="px-4 py-3">
                  {l.license_activations?.[0]?.count ?? 0} / {l.max_activations}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={l.status}
                    onChange={(e) => statusMut.mutate({ id: l.id, status: e.target.value })}
                    className="text-xs rounded-md border border-border bg-background px-2 py-1"
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="revoked">revoked</option>
                    <option value="expired">expired</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  Issued {new Date(l.issued_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {licenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No licenses issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif italic">Issue license</h2>
              <button onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate();
              }}
              className="space-y-3"
            >
              <input required placeholder="Client / company name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input required type="email" placeholder="Client email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as any })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <input type="number" min={1} max={50} value={form.max_activations} onChange={(e) => setForm({ ...form, max_activations: parseInt(e.target.value) || 1 })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Max activations" />
              </div>
              <textarea placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <button disabled={createMut.isPending} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {createMut.isPending ? "Issuing…" : "Issue license"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
