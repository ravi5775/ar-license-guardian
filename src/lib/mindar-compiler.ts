// Browser-side MindAR image-target compiler. Compiles multiple photos into a
// single .mind file so one QR code can cover a whole album.
//
// NOTE: mind-ar's dist bundles are ES modules (they `import` sibling chunks),
// so they can NOT be loaded with a classic <script> tag — doing so throws a
// syntax error and leaves window.MINDAR undefined ("AR compiler unavailable").
// We load them with a real dynamic import instead, with CDN fallbacks.
const COMPILER_URLS = [
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js",
  "https://unpkg.com/mind-ar@1.2.5/dist/mindar-image.prod.js",
  "https://esm.sh/mind-ar@1.2.5/dist/mindar-image.prod.js",
];

type CompilerCtor = new () => {
  compileImageTargets: (
    images: HTMLImageElement[],
    onProgress: (p: number) => void,
  ) => Promise<unknown>;
  exportData: () => Promise<ArrayBuffer>;
};

let compilerPromise: Promise<CompilerCtor> | null = null;

async function loadCompiler(): Promise<CompilerCtor> {
  if (compilerPromise) return compilerPromise;

  compilerPromise = (async () => {
    // Already loaded by the AR viewer on this page?
    const existing = (window as any).MINDAR?.IMAGE?.Compiler;
    if (existing) return existing as CompilerCtor;

    let lastError: unknown = null;
    for (const url of COMPILER_URLS) {
      try {
        const mod: any = await import(/* @vite-ignore */ url);
        const Compiler =
          mod?.Compiler ??
          mod?.default?.Compiler ??
          (window as any).MINDAR?.IMAGE?.Compiler;
        if (Compiler) return Compiler as CompilerCtor;
        lastError = new Error(`No Compiler export from ${url}`);
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(
      `Could not load the AR compiler — check your internet connection and try again. (${
        lastError instanceof Error ? lastError.message : String(lastError)
      })`,
    );
  })();

  compilerPromise.catch(() => {
    compilerPromise = null;
  });
  return compilerPromise;
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
  const Compiler = await loadCompiler();

  const images = await Promise.all(files.map(fileToImage));
  const compiler = new Compiler();
  await compiler.compileImageTargets(images, (p: number) => {
    onProgress?.(Math.max(0, Math.min(100, Math.round(p))));
  });
  const buffer = await compiler.exportData();
  return new Blob([buffer], { type: "application/octet-stream" });
}
