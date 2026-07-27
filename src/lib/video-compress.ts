/**
 * Browser-side video compression with ffmpeg.wasm.
 *
 * Runs entirely off the main thread: @ffmpeg/ffmpeg v0.12 spawns its own
 * Web Worker and the wasm core executes inside it, so the admin UI stays
 * responsive while encoding.
 *
 * Threading: the multi-threaded core needs SharedArrayBuffer, which requires
 * cross-origin isolation (COOP: same-origin + COEP: require-corp). We do not
 * force COEP on the whole app because it would break the third-party CDN and
 * storage resources the AR viewer loads. Instead we detect isolation at
 * runtime and transparently fall back to the single-threaded core, warning
 * the admin that encoding will take longer.
 *
 * This module is browser-only — import it lazily from event handlers.
 */

const CORE_VERSION = "0.12.10";
const MT_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`;
const ST_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

/** Hard server-side cap; mirrored here so the UI can explain rejections early. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const COMPRESSION_TIMEOUT_MS = 90_000;

export type CompressStage = "probing" | "loading" | "compressing";

export interface CompressProgress {
  stage: CompressStage;
  /** 0-100 */
  percent: number;
  multithreaded: boolean;
}

export interface CompressResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  /** True when compression was skipped/failed and the original is returned. */
  fellBack: boolean;
  reason?: string;
  multithreaded: boolean;
}

export function canUseMultithread(): boolean {
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    typeof crossOriginIsolated !== "undefined" &&
    crossOriginIsolated === true
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Reads duration + whether the clip carries an audio track. */
async function probe(file: File): Promise<{ duration: number; hasAudio: boolean }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    const duration = await new Promise<number>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Could not read video metadata")), 15_000);
      video.onloadedmetadata = () => {
        clearTimeout(t);
        resolve(Number.isFinite(video.duration) ? video.duration : 0);
      };
      video.onerror = () => {
        clearTimeout(t);
        reject(new Error("Unsupported or corrupt video file"));
      };
    });
    const anyVideo = video as HTMLVideoElement & {
      mozHasAudio?: boolean;
      webkitAudioDecodedByteCount?: number;
      audioTracks?: { length: number };
    };
    const hasAudio =
      anyVideo.mozHasAudio === true ||
      (anyVideo.webkitAudioDecodedByteCount ?? 0) > 0 ||
      (anyVideo.audioTracks?.length ?? 0) > 0 ||
      // Metadata alone often can't tell; assume audio exists and let ffmpeg
      // decide — `-c:a aac` is a no-op when there is no audio stream.
      true;
    return { duration, hasAudio };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** bitrate_kbps = (35 × 8192 / duration) − 128, floored at 2000 kbps. */
export function targetBitrateKbps(durationSeconds: number): number {
  if (!durationSeconds || durationSeconds <= 0) return 4000;
  const raw = (35 * 8192) / durationSeconds - 128;
  return Math.max(2000, Math.min(12_000, Math.round(raw)));
}

let ffmpegSingleton: any = null;
let loadedMt = false;

async function getFFmpeg(mt: boolean, onLog?: (m: string) => void) {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");

  if (ffmpegSingleton && loadedMt === mt) return ffmpegSingleton;

  const base = mt ? MT_BASE : ST_BASE;
  const ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on("log", ({ message }: { message: string }) => onLog(message));

  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    ...(mt
      ? { workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript") }
      : {}),
  });

  ffmpegSingleton = ffmpeg;
  loadedMt = mt;
  return ffmpeg;
}

/**
 * Compresses a video to <=1080p H.264/AAC MP4.
 * Never throws for encoding problems — returns the original file with
 * `fellBack: true` so the caller can decide whether the raw file is small
 * enough to upload as-is.
 */
export async function compressVideo(
  file: File,
  onProgress?: (p: CompressProgress) => void,
  opts?: { keepAudio?: boolean; timeoutMs?: number },
): Promise<CompressResult> {
  const mt = canUseMultithread();
  const originalBytes = file.size;
  const emit = (stage: CompressStage, percent: number) =>
    onProgress?.({ stage, percent: Math.max(0, Math.min(100, Math.round(percent))), multithreaded: mt });

  const bail = (reason: string): CompressResult => ({
    file,
    originalBytes,
    compressedBytes: originalBytes,
    fellBack: true,
    reason,
    multithreaded: mt,
  });

  let duration = 0;
  let hasAudio = true;
  try {
    emit("probing", 0);
    const p = await probe(file);
    duration = p.duration;
    hasAudio = p.hasAudio;
  } catch (e: any) {
    return bail(e?.message ?? "Could not read this video");
  }

  const keepAudio = opts?.keepAudio ?? hasAudio;
  const bitrate = targetBitrateKbps(duration);

  let ffmpeg: any;
  try {
    emit("loading", 0);
    ffmpeg = await getFFmpeg(mt, undefined);
  } catch {
    return bail("Compression engine unavailable in this browser");
  }

  const inName = "input" + (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mp4");
  const outName = "output.mp4";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    try {
      ffmpeg.terminate();
    } catch {
      /* already gone */
    }
    ffmpegSingleton = null;
  }, opts?.timeoutMs ?? COMPRESSION_TIMEOUT_MS);

  try {
    const { fetchFile } = await import("@ffmpeg/util");
    await ffmpeg.writeFile(inName, await fetchFile(file));

    const onProg = ({ progress }: { progress: number }) =>
      emit("compressing", progress * 100);
    ffmpeg.on("progress", onProg);

    // Downscale so neither edge exceeds 1920x1080 while keeping aspect ratio
    // (portrait clips are constrained by their shorter edge automatically).
    const scale =
      "scale='if(gt(iw/ih,16/9),min(1920,iw),-2)':'if(gt(iw/ih,16/9),-2,min(1080,ih))'," +
      "scale=trunc(iw/2)*2:trunc(ih/2)*2";

    const args = [
      "-i", inName,
      "-vf", scale,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-b:v", `${bitrate}k`,
      "-maxrate", `${Math.round(bitrate * 1.5)}k`,
      "-bufsize", `${bitrate * 2}k`,
      "-movflags", "+faststart",
      ...(keepAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]),
      outName,
    ];

    const code = await ffmpeg.exec(args);
    ffmpeg.off?.("progress", onProg);
    if (timedOut) return bail("Compression timed out");
    if (code !== 0) return bail("Compression failed");

    const out = (await ffmpeg.readFile(outName)) as Uint8Array;
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});

    if (!out || out.byteLength === 0) return bail("Compression produced an empty file");

    const buffer = new Uint8Array(out).slice().buffer as ArrayBuffer;
    const compressed = new File(
      [buffer],
      file.name.replace(/\.[a-z0-9]+$/i, "") + ".mp4",
      { type: "video/mp4" },
    );

    // Never hand back something bigger than the source.
    if (compressed.size >= originalBytes) {
      return { ...bail("Original was already smaller"), fellBack: true };
    }

    emit("compressing", 100);
    return {
      file: compressed,
      originalBytes,
      compressedBytes: compressed.size,
      fellBack: false,
      multithreaded: mt,
    };
  } catch (e: any) {
    return bail(timedOut ? "Compression timed out" : e?.message ?? "Compression failed");
  } finally {
    clearTimeout(timeout);
  }
}
