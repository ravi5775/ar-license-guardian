// Browser-side MindAR image-target compiler. Compiles multiple photos into a
// single .mind file so one QR code can cover a whole album.
const COMPILER_SCRIPT =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js";

let scriptPromise: Promise<void> | null = null;

function loadCompilerScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${COMPILER_SCRIPT}"]`,
    ) as HTMLScriptElement | null;
    if (existing && existing.dataset.loaded === "true") return resolve();
    const s = existing ?? document.createElement("script");
    s.src = COMPILER_SCRIPT;
    s.async = true;
    s.addEventListener(
      "load",
      () => {
        s.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    s.addEventListener(
      "error",
      () => reject(new Error("Failed to load the AR compiler")),
      { once: true },
    );
    if (!existing) document.head.appendChild(s);
  });
  scriptPromise.catch(() => {
    scriptPromise = null;
  });
  return scriptPromise;
}

function fileToImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read image: ${file.name}`));
    };
    img.src = url;
  });
}

/**
 * Compiles the given photos (in order) into one .mind file.
 * Each photo's position in the array becomes its MindAR targetIndex.
 */
export async function compileAlbumTargets(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  await loadCompilerScript();
  const MINDAR = (window as any).MINDAR;
  const Compiler = MINDAR?.IMAGE?.Compiler;
  if (!Compiler) throw new Error("AR compiler unavailable — please reload");

  const images = await Promise.all(files.map(fileToImage));
  const compiler = new Compiler();
  await compiler.compileImageTargets(images, (p: number) => {
    onProgress?.(Math.max(0, Math.min(100, Math.round(p))));
  });
  const buffer = await compiler.exportData();
  return new Blob([buffer], { type: "application/octet-stream" });
}
