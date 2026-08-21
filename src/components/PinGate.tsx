import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { submitAccessPin } from "@/lib/access.functions";

/**
 * Shown when a restricted album/experience is opened without the signed
 * token from its printed QR. Wrong entries return a deliberately generic
 * message — no attempt counts, no lockout timing.
 */
export function PinGate({
  kind,
  slug,
  title,
}: {
  kind: "album" | "experience";
  slug: string;
  title: string;
}) {
  const submit = useServerFn(submitAccessPin);
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submit({ data: { kind, slug, pin: pin.trim() } });
      if (res.ok) {
        await router.invalidate();
      } else {
        setError(res.message);
        setPin("");
      }
    } catch {
      setError("Incorrect PIN.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-8 text-center"
      >
        <Lock className="mx-auto h-7 w-7 text-primary mb-4" />
        <h1 className="text-2xl font-serif italic mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This {kind === "album" ? "album" : "experience"} is private. Enter the PIN printed on your
          card.
        </p>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.slice(0, 8))}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label="Access PIN"
          placeholder="••••"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.4em]"
        />

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy || pin.trim().length === 0}
          className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          Scanning the QR code on your card opens this instantly, no PIN needed.
        </p>
      </form>
    </div>
  );
}
