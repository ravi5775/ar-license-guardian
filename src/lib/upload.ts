import { signMediaUpload, enforceMediaSize } from "@/lib/experiences.functions";
import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/video-compress";

export interface UploadProgress {
  stage: "compressing" | "uploading";
  percent: number;
  note?: string;
}

/**
 * Uploads a file/blob to the private ar-media bucket and returns its path.
 * Videos are compressed in the browser (<=1080p H.264/AAC MP4) before upload;
 * if compression is unavailable the original is used when it fits the limit.
 */
export async function uploadToArMedia(
  file: File | Blob,
  prefix: string,
  filename?: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const name = filename ?? (file instanceof File ? file.name : "asset.bin");
  let payload: File | Blob = file;
  let uploadName = name;

  if (file instanceof File && file.type.startsWith("video/")) {
    const { compressVideo } = await import("@/lib/video-compress");
    const result = await compressVideo(file, (p) =>
      onProgress?.({
        stage: "compressing",
        percent: p.stage === "compressing" ? p.percent : 0,
        note: p.multithreaded ? undefined : "single-threaded — this may take longer",
      }),
    );
    if (!result.fellBack) {
      payload = result.file;
      uploadName = result.file.name;
    } else if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `Couldn't compress this video (${result.reason ?? "unknown error"}) and the original is ${formatBytes(
          file.size,
        )} — over the 50 MB limit.`,
      );
    }
  }

  if (payload.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${formatBytes(payload.size)} exceeds the 50 MB upload limit.`);
  }

  onProgress?.({ stage: "uploading", percent: 0 });
  const ext = uploadName.split(".").pop() || "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const signed = await signMediaUpload({
    data: { path, upsert: true, size: payload.size },
  });
  const { error } = await supabase.storage
    .from("ar-media")
    .uploadToSignedUrl(signed.path, signed.token, payload, {
      contentType: payload.type || "application/octet-stream",
      upsert: true,
    });
  if (error) throw error;
  onProgress?.({ stage: "uploading", percent: 100 });

  // Server-side backstop — deletes the object if it exceeds the hard limit.
  await enforceMediaSize({ data: { path: signed.path } });

  return signed.path;
}
