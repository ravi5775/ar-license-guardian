import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount } from "@/lib/approvals.functions";
import { Clock, Copy, LogOut, ShieldX, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pending")({
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAccount = useServerFn(getMyAccount);

  const { data, isLoading } = useQuery({
    queryKey: ["my-account"],
    queryFn: () => fetchAccount(),
    refetchInterval: 30_000,
  });

  const status = data?.profile?.approval_status ?? "pending";
  const license = data?.license ?? null;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/30 backdrop-blur-xl p-8">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-serif italic">Aether AR</span>
        </Link>

        {status === "rejected" ? (
          <>
            <ShieldX className="h-8 w-8 text-destructive mb-4" />
            <h1 className="text-2xl font-serif mb-2">Account not approved</h1>
            <p className="text-sm text-muted-foreground">
              {data?.profile?.rejection_reason ||
                "An administrator declined access for this account. Reply to your onboarding email if you think this is a mistake."}
            </p>
          </>
        ) : status === "approved" ? (
          <>
            <h1 className="text-2xl font-serif mb-2">You're approved</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your workspace and licence are ready.
            </p>
            {license && <LicenseCard license={license} />}
            <Link
              to="/dashboard"
              className="mt-6 inline-flex rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium"
            >
              Open dashboard
            </Link>
          </>
        ) : (
          <>
            <Clock className="h-8 w-8 text-primary mb-4" />
            <h1 className="text-2xl font-serif mb-2">Waiting for admin approval</h1>
            <p className="text-sm text-muted-foreground">
              Your account <span className="text-foreground">{data?.profile?.email}</span> was
              created successfully. An administrator has to approve it before you can publish AR
              experiences. Your licence key is issued automatically the moment you're approved —
              this page refreshes itself.
            </p>
            {isLoading && (
              <p className="mt-4 text-xs text-muted-foreground animate-pulse">
                Checking your status…
              </p>
            )}
          </>
        )}

        <button
          onClick={signOut}
          className="mt-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function LicenseCard({ license }: { license: any }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
        Your licence key
      </p>
      <div className="flex items-center gap-2">
        <code className="text-sm break-all">{license.license_key}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(license.license_key);
            toast.success("Licence key copied");
          }}
          className="shrink-0 rounded-md p-1.5 hover:bg-accent"
          aria-label="Copy licence key"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {license.plan} · {license.max_activations} activation
        {license.max_activations === 1 ? "" : "s"} · {license.status}
      </p>
    </div>
  );
}
