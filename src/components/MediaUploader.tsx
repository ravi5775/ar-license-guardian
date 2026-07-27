import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { signMediaUpload, enforceMediaSize } from "@/lib/experiences.functions";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, Check, Cpu } from "lucide-react";
import { toast } from "sonner";
import { MAX_UPLOAD_BYTES, formatBytes, canUseMultithread } from "@/lib/video-compress";

interface Props {
  label: string;
  accept: string;
  currentPath?: string | null;
  onUploaded: (path: string) => void;
  prefix: string; // e.g. "markers" or "media"
}

type Phase =
  | { kind: "idle" }
  | { kind: "compressing"; percent: number; note: string }
  | { kind: "uploading"; percent: number };

export function MediaUploader({ label, accept, currentPath, onUploaded, prefix }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const signFn = useServerFn(signMediaUpload);
  const enforceFn = useServerFn(enforceMediaSize);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [savings, setSavings] = useState<string | null>(null);

  const busy = phase.kind !== "idle";

  async function handleFile(original: File) {
    setSavings(null);
    let file = original;

    try {
      /* ---------------- Stage 1 — compression (video only) -------------- */
      if (original.type.startsWith("video/")) {
        const mt = canUseMultithread();
        setPhase({
          kind: "compressing",
          percent: 0,
          note: mt ? "" : "single-threaded — this may take longer",
        });

        const { compressVideo } = await import("@/lib/video-compress");
        const result = await compressVideo(original, (p) => {
          setPhase({
            kind: "compressing",
            percent: p.stage === "compressing" ? p.percent : 0,
            note:
              p.stage === "loading"
                ? "loading encoder…"
                : p.stage === "probing"
                  ? "reading video…"
                  : p.multithreaded
                    ? ""
                    : "single-threaded — this may take longer",
          });
        });

        if (result.fellBack) {
          if (original.size > MAX_UPLOAD_BYTES) {
            throw new Error(
              `Couldn't compress this video (${result.reason ?? "unknown error"}) and the original is ${formatBytes(
                original.size,
              )} — over the 50 MB limit. Trim the clip or compress it externally, then try again.`,
            );
          }
          toast.warning(
            `Compression skipped (${result.reason ?? "unavailable"}) — uploading the original at ${formatBytes(original.size)}.`,
          );
        } else {
          file = result.file;
          setSavings(
            `${formatBytes(result.originalBytes)} → ${formatBytes(result.compressedBytes)}`,
          );
        }
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `${formatBytes(file.size)} exceeds the 50 MB upload limit. Trim the clip or compress it externally first.`,
        );
      }

      /* ---------------- Stage 2 — upload -------------------------------- */
      setPhase({ kind: "uploading", percent: 0 });
      const ext = file.name.split(".").pop() || "bin";
      const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
      const signed = await signFn({ data: { path, upsert: true, size: file.size } });

      const { error } = await supabase.storage
        .from("ar-media")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
          upsert: true,
        });
      if (error) throw error;

      setPhase({ kind: "uploading", percent: 100 });
      // Server-side backstop: verifies the real object size and deletes it
      // if a client bypassed the limit.
      await enforceFn({ data: { path: signed.path } });

      onUploaded(signed.path);
      toast.success(
        savings ? `${label} uploaded — compressed ${savings}` : `${label} uploaded`,
      );
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setPhase({ kind: "idle" });
    }
  }

  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex-1 inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
        >
          {phase.kind === "compressing" ? (
            <>
              <Cpu className="h-3 w-3 animate-pulse" /> Compressing {phase.percent}%
            </>
          ) : phase.kind === "uploading" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading {phase.percent}%
            </>
          ) : currentPath ? (
            <>
              <Check className="h-3 w-3 text-primary" />
              <span className="truncate">{currentPath.split("/").pop()}</span>
              <span className="ml-auto text-muted-foreground">Replace</span>
            </>
          ) : (
            <>
              <Upload className="h-3 w-3" /> Choose file
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {phase.kind !== "idle" && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-[width] duration-200 ${
                phase.kind === "compressing" ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${phase.percent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {phase.kind === "compressing"
              ? `Compressing on this device${phase.note ? ` — ${phase.note}` : ""}`
              : "Uploading to secure storage"}
          </p>
        </div>
      )}

      {phase.kind === "idle" && savings && (
        <p className="mt-1 text-[11px] text-primary">Compressed {savings}</p>
      )}
    </div>
  );
}
