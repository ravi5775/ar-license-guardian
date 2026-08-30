import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/setup")({
  component: ClientSetupWizardPage,
});

interface EnvCheckResult {
  key: string;
  category: "licensing" | "storage" | "database" | "fingerprint";
  configured: boolean;
  message: string;
}

function ClientSetupWizardPage() {
  const [checks, setChecks] = useState<EnvCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  const runDiagnostics = () => {
    setIsChecking(true);
    const env = (import.meta.env as Record<string, string | undefined>) || {};

    const results: EnvCheckResult[] = [
      // Licensing
      {
        key: "VITE_LICENCE_KEY",
        category: "licensing",
        configured: Boolean(env.VITE_LICENCE_KEY && env.VITE_LICENCE_KEY.startsWith("AETH-")),
        message: env.VITE_LICENCE_KEY
          ? "Valid license key format configured."
          : "Missing or invalid license key format (must start with AETH-).",
      },
      {
        key: "VITE_LICENCE_API_URL",
        category: "licensing",
        configured: Boolean(
          env.VITE_LICENCE_API_URL && env.VITE_LICENCE_API_URL.startsWith("http"),
        ),
        message: env.VITE_LICENCE_API_URL
          ? "License authority endpoint specified."
          : "Missing central license authority URL.",
      },
      {
        key: "VITE_LICENCE_PUBLIC_KEY",
        category: "licensing",
        configured: Boolean(env.VITE_LICENCE_PUBLIC_KEY && env.VITE_LICENCE_PUBLIC_KEY.length > 20),
        message: env.VITE_LICENCE_PUBLIC_KEY
          ? "Ed25519 public JWK loaded for cryptographic verification."
          : "Missing Ed25519 public key in client environment.",
      },
      // Build Fingerprint
      {
        key: "VITE_CUSTOMER_ID",
        category: "fingerprint",
        configured: Boolean(env.VITE_CUSTOMER_ID && env.VITE_CUSTOMER_ID.length >= 16),
        message: env.VITE_CUSTOMER_ID
          ? "Unique Customer UUID bound to this installation."
          : "Missing customer identifier (required for provenance verification).",
      },
      {
        key: "VITE_BUILD_ID",
        category: "fingerprint",
        configured: Boolean(env.VITE_BUILD_ID),
        message: env.VITE_BUILD_ID
          ? "Release build identifier detected."
          : "Missing build identifier.",
      },
      // Supabase / Database
      {
        key: "VITE_SUPABASE_URL",
        category: "database",
        configured: Boolean(env.VITE_SUPABASE_URL || env.DATABASE_URL),
        message:
          env.VITE_SUPABASE_URL || env.DATABASE_URL
            ? "Database endpoint connected."
            : "Missing Supabase URL or DATABASE_URL.",
      },
    ];

    setChecks(results);
    setIsChecking(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const total = checks.length;
  const passed = checks.filter((c) => c.configured).length;
  const allPassed = passed === total;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-card border border-border/70 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-semibold">Client Environment Setup Wizard</h1>
              <p className="text-xs text-muted-foreground">
                Pre-flight configuration validation for Aether AR
              </p>
            </div>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={isChecking}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            Re-test
          </button>
        </div>

        {/* Overall Health Status Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
            allPassed
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}
        >
          {allPassed ? (
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-sm">
              {allPassed
                ? "All Client Configuration Checks Passed!"
                : `Configuration Incomplete (${passed}/${total} checks passed)`}
            </p>
            <p className="text-xs opacity-90">
              {allPassed
                ? "This deployment is fully verified and ready to serve AR experiences."
                : "Resolve the missing environment variables below in Cloudflare Pages or your .env file."}
            </p>
          </div>
        </div>

        {/* Checks Breakdown */}
        <div className="space-y-3">
          {checks.map((check) => (
            <div
              key={check.key}
              className="flex items-start justify-between p-3.5 rounded-xl border border-border/50 bg-background/50 text-xs"
            >
              <div className="space-y-1 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">{check.key}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {check.category}
                  </span>
                </div>
                <p className="text-muted-foreground">{check.message}</p>
              </div>
              <div className="pt-0.5">
                {check.configured ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive font-medium">
                    <XCircle className="w-4 h-4" /> Missing
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Need help? Refer to <code>CLIENT_README.md</code> in your project root.
          </p>
          {allPassed && (
            <a
              href="/"
              className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Launch AR App →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
