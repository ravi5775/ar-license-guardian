import { signMediaUpload } from "@/lib/experiences.functions";
import { supabase } from "@/integrations/supabase/client";

/** Uploads a file/blob to the private ar-media bucket and returns its path. */
export async function uploadToArMedia(
  file: File | Blob,
  prefix: string,
  filename?: string,
): Promise<string> {
  const name =
    filename ?? (file instanceof File ? file.name : "asset.bin");
  const ext = name.split(".").pop() || "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const signed = await signMediaUpload({ data: { path, upsert: true } });
  const { error } = await supabase.storage
    .from("ar-media")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (error) throw error;
  return signed.path;
}
