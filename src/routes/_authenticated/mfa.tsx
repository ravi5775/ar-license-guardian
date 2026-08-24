import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/_authenticated/mfa")({
  validateSearch: searchSchema,
  component: MFAPage,
});

function MFAPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/_authenticated/mfa" });
  const [mode, setMode] = useState<"loading" | "enroll" | "challenge">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }
      // Enroll a new factor
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) {
        toast.error(error.message);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setMode("enroll");
    })();
  }, []);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      toast.success("Two-factor verified");
      navigate({ to: redirect || "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card/40 p-8">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-serif italic">
            {mode === "enroll" ? "Enable two-factor" : "Enter your code"}
          </h1>
        </div>

        {mode === "enroll" && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Admin accounts require TOTP. Scan this QR code with Google Authenticator, 1Password,
              or Authy — then enter the 6-digit code below.
            </p>
            {qr && (
              <img
                src={qr}
                alt="TOTP QR"
                className="w-48 h-48 mx-auto mb-3 rounded-md bg-white p-2"
              />
            )}
            {secret && (
              <p className="text-xs text-center text-muted-foreground mb-4">
                Or enter secret manually:{" "}
                <code className="font-mono text-foreground">{secret}</code>
              </p>
            )}
          </>
        )}

        {mode === "challenge" && (
          <p className="text-sm text-muted-foreground mb-4">
            Open your authenticator app and enter the current 6-digit code.
          </p>
        )}

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="000000"
          className="w-full text-center text-2xl font-mono tracking-widest rounded-md border border-border bg-background px-3 py-3 mb-4"
        />

        <button
          onClick={verify}
          disabled={busy || code.length !== 6}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Verifying…" : mode === "enroll" ? "Enable 2FA" : "Verify"}
        </button>
      </div>
    </div>
  );
}
