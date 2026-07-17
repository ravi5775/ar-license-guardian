import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { signMediaUpload } from "@/lib/experiences.functions";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  label: string;
  accept: string;
  currentPath?: string | null;
  onUploaded: (path: string) => void;
  prefix: string; // e.g. "markers" or "media"
}

export function MediaUploader({ label, accept, currentPath, onUploaded, prefix }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const signFn = useServerFn(signMediaUpload);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    // Soft warning — large overlay media is the #1 cause of laggy AR playback on mobile.
    const MB = 1024 * 1024;
    if (file.type.startsWith("video/") && file.size > 20 * MB) {
      const proceed = window.confirm(
        `This video is ${(file.size / MB).toFixed(1)} MB. For smooth AR playback, we recommend ≤720p H.264 under 20 MB. Upload anyway?`,
      );
      if (!proceed) return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
      const signed = await signFn({ data: { path, upsert: true } });

      // Upload via supabase client using the signed URL token
      const { error } = await supabase.storage
        .from("ar-media")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
          upsert: true,
        });
      if (error) throw error;

      setProgress(100);
      onUploaded(signed.path);
      toast.success(`${label} uploaded`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-1 inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading {progress}%
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
    </div>
  );
}
