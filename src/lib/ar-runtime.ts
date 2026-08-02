/**
 * Shared runtime helpers for the MindAR + A-Frame viewers.
 *
 * Everything in here is scoped to the AR stage container (`.ar-stage-root`).
 * No global page CSS is modified — the stylesheet below is injected once at
 * runtime and every selector is nested under the AR container class.
 *
 * Why this file exists (root causes it addresses):
 *
 * 1. FIT — MindAR's internal `_resize()` measures `container.clientWidth /
 *    clientHeight` (the <a-scene> box) and sizes the camera video + three.js
 *    camera from it. The viewers previously set `height: 100vh` on the scene.
 *    On mobile `100vh` is the *largest* possible viewport (URL bar collapsed),
 *    so while the bar is visible the scene box is taller than what the user
 *    can see: the camera feed is scaled for a taller box and the projection
 *    aspect no longer matches the visible area — content sits off-centre and
 *    overflows under the browser chrome.
 * 2. RESIZE — MindAR binds `window.resize` only. It never listens to
 *    `orientationchange`, `visualViewport` resize (URL-bar collapse, iOS
 *    keyboard/zoom) and never re-runs after the camera track flips its
 *    videoWidth/videoHeight on rotation. On iOS the single `resize` event
 *    fires *before* the video dimensions swap, so the fit is computed from
 *    stale dimensions and stays wrong until the next unrelated resize.
 * 3. LAG — MindAR takes whatever resolution getUserMedia hands it (often
 *    1280x720+ at 60fps). The tracker downsamples per frame on the CPU, so
 *    input resolution is the single biggest cost on low-end phones.
 */

export const AR_STAGE_CLASS = "ar-stage-root";

const STYLE_ID = "ar-stage-scoped-styles";

/**
 * Injects the AR-only stylesheet once. All rules are scoped under
 * `.ar-stage-root` so nothing outside the AR viewer is affected.
 */
export function ensureArStageStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.${AR_STAGE_CLASS} {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;            /* fallback for browsers without dvh */
  height: 100dvh;           /* tracks the *visible* viewport on mobile */
  overflow: hidden;
  touch-action: manipulation;
  background: #000;
}
.${AR_STAGE_CLASS} > a-scene,
.${AR_STAGE_CLASS} > a-scene .a-canvas {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: block;
}
/* MindAR positions its camera feed with inline px values; keep it clipped
   to the stage instead of the document. */
.${AR_STAGE_CLASS} video {
  position: absolute;
  max-width: none;
}
/* Safe-area padding for the AR HUD only (notch / home indicator). */
.ar-stage-safe-top { padding-top: max(1rem, env(safe-area-inset-top)); }
.ar-stage-safe-bottom { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
`;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/* Device tiering                                                      */
/* ------------------------------------------------------------------ */

export type DeviceTier = "low" | "mid" | "high";

const PERF_KEY = "aether-ar-perf-mode";

/** User-forced performance mode. "lite" pins the low tier on old hardware. */
export type PerfMode = "auto" | "lite";

export function getPerfMode(): PerfMode {
  if (typeof localStorage === "undefined") return "auto";
  return localStorage.getItem(PERF_KEY) === "lite" ? "lite" : "auto";
}

export function setPerfMode(mode: PerfMode) {
  if (typeof localStorage === "undefined") return;
  if (mode === "lite") localStorage.setItem(PERF_KEY, "lite");
  else localStorage.removeItem(PERF_KEY);
}

/**
 * Cheap, synchronous capability probe. deviceMemory/hardwareConcurrency are
 * absent on iOS Safari, so we fall back to DPR × screen size heuristics.
 */
export function detectDeviceTier(): DeviceTier {
  if (typeof navigator === "undefined") return "mid";
  if (getPerfMode() === "lite") return "low";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  const mem = nav.deviceMemory ?? 0;
  const cores = nav.hardwareConcurrency ?? 0;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  if ((mem && mem <= 3) || (cores && cores <= 4)) return "low";
  if ((mem && mem >= 8) || (cores && cores >= 8)) return dpr > 3 ? "mid" : "high";
  return "mid";
}

/** Longest camera edge we let the tracker chew on, per tier. */
const CAMERA_CAP: Record<DeviceTier, number> = {
  low: 480,
  mid: 854,
  high: 1280,
};

/** Camera framerate cap — every extra frame is a full CPU tracking pass. */
const FPS_CAP: Record<DeviceTier, number> = {
  low: 24,
  mid: 30,
  high: 30,
};

/** Canvas cap keeps fragment cost bounded on high-DPR phones. */
const CANVAS_CAP: Record<DeviceTier, number> = {
  low: 720,
  mid: 1280,
  high: 1600,
};

/** Hard ceiling on devicePixelRatio — the single biggest fragment-cost lever. */
const DPR_CAP: Record<DeviceTier, number> = {
  low: 1,
  mid: 1.5,
  high: 2,
};

/**
 * MindAR image-tracking config string.
 *
 * The previous values (filterMinCF: 0.001 / filterBeta: 1000 /
 * warmupTolerance: 3 / missTolerance: 3) were MindAR's own defaults, i.e. no
 * tuning at all. The One-Euro filter behaves like this:
 *   filterMinCF  — cutoff at rest. LOWER = more smoothing when the phone is
 *                  still (kills the micro-jitter of a handheld shot).
 *   filterBeta   — how fast the cutoff opens up with motion. HIGHER = less
 *                  lag while panning, at the cost of jitter.
 * We therefore lower minCF (steadier lock) and keep beta high enough that a
 * pan still feels attached. Low-tier phones get slightly more smoothing
 * because their frame times are longer and noisier.
 *
 *   warmupTolerance — frames a target must be seen before it is declared
 *                     found. 2 = snappier lock-on than the default 5.
 *   missTolerance   — frames it may be missed before "lost". 4 keeps the
 *                     overlay alive through a blink/blur instead of flashing.
 *   maxTrack        — each simultaneously tracked target costs a full
 *                     tracking pass per frame. Always 1 unless the album
 *                     genuinely shows two prints at once.
 */
export function mindarConfig(opts: {
  imageTargetSrc: string;
  tier: DeviceTier;
  maxTrack?: number;
}) {
  const { imageTargetSrc, tier, maxTrack = 1 } = opts;
  const filterMinCF = tier === "low" ? 0.00008 : 0.0001;
  const filterBeta = tier === "low" ? 400 : 1000;
  return [
    `imageTargetSrc: ${imageTargetSrc}`,
    "autoStart: true",
    "uiScanning: no",
    "uiLoading: no",
    "uiError: no",
    `maxTrack: ${maxTrack}`,
    `filterMinCF: ${filterMinCF}`,
    `filterBeta: ${filterBeta}`,
    "warmupTolerance: 2",
    "missTolerance: 4",
  ].join("; ");
}

/**
 * A-Frame renderer config. `colorManagement` stays on (otherwise video looks
 * washed out); `physicallyCorrectLights` and `color-space` are removed —
 * both are no-ops in A-Frame 1.5 / three r1xx and only emit deprecation spam.
 */
export function rendererConfig(tier: DeviceTier) {
  const cap = CANVAS_CAP[tier];
  return [
    "colorManagement: true",
    `antialias: ${tier === "high"}`,
    "precision: mediump",
    "sortObjects: false",
    "logarithmicDepthBuffer: false",
    `maxCanvasWidth: ${cap}`,
    `maxCanvasHeight: ${cap}`,
  ].join(", ");
}

/**
 * Strips A-Frame's built-in extras we never use. Each of these otherwise
 * costs DOM, listeners, a default light rig (2 extra lights => extra shader
 * permutations and draw setup) or an extra rAF-driven overlay.
 */
export function applySceneHygiene(scene: HTMLElement) {
  scene.setAttribute("vr-mode-ui", "enabled: false");
  scene.setAttribute("device-orientation-permission-ui", "enabled: false");
  scene.setAttribute("keyboard-shortcuts", "enterVR: false; exitVR: false");
  // a-video / a-image use unlit materials — the default light rig is dead weight.
  scene.setAttribute("light", "defaultLightsEnabled: false");
  scene.setAttribute("shadow", "enabled: false");
  scene.setAttribute("embedded", "");
  // NOTE: no `stats` attribute at all. `stats="false"` still registers the
  // component and adds a per-frame rAF sampler on some A-Frame builds.
  scene.removeAttribute("stats");
}

/* ------------------------------------------------------------------ */
/* Viewport fit                                                        */
/* ------------------------------------------------------------------ */

type Cleanup = () => void;

/**
 * Keeps the A-Frame canvas, the three.js camera projection and MindAR's
 * camera-feed transform in sync with the *visible* viewport.
 *
 * Also caps the camera track resolution/framerate once the stream is live —
 * MindAR does not expose getUserMedia constraints, but the track can be
 * re-constrained after the fact, which is the single biggest tracking-lag
 * lever on low-end hardware.
 */
export function attachArViewportFit(
  scene: any,
  tier: DeviceTier = detectDeviceTier(),
): Cleanup {
  if (typeof window === "undefined") return () => {};
  let disposed = false;
  let frame = 0;

  const runFit = () => {
    if (disposed || !scene?.isConnected) return;
    try {
      // 1. A-Frame: renderer size + camera aspect from the container box.
      scene.resize?.();
      // 2. MindAR: camera-feed cover transform + projection fov/aspect.
      scene.systems?.["mindar-image-system"]?._resize?.();
    } catch {
      /* scene torn down mid-flight */
    }
  };

  const schedule = () => {
    if (disposed) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      runFit();
      // Second pass on the next tick: on iOS the video's intrinsic
      // dimensions swap one frame *after* the resize event fires.
      setTimeout(runFit, 250);
    });
  };

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  const vv = window.visualViewport;
  vv?.addEventListener("resize", schedule);
  vv?.addEventListener("scroll", schedule);
  const mq = window.matchMedia("(orientation: portrait)");
  mq.addEventListener?.("change", schedule);

  // Constrain the camera track + fit again once the feed actually starts.
  let polls = 0;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  const tuneStream = () => {
    if (disposed) return;
    const video = scene.systems?.["mindar-image-system"]?.video as
      | HTMLVideoElement
      | undefined;
    if (video?.videoWidth) {
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        const track = stream.getVideoTracks()[0];
        void track?.applyConstraints({
          width: { max: CAMERA_CAP[tier] },
          frameRate: { max: FPS_CAP[tier] },
        }).catch(() => {});
      }
      video.addEventListener("loadedmetadata", schedule);
      video.addEventListener("resize", schedule);
      schedule();
      return;
    }
    if (polls++ < 60) pollTimer = setTimeout(tuneStream, 250);
  };
  tuneStream();

  scene.addEventListener?.("renderstart", schedule);
  scene.addEventListener?.("arReady", schedule);
  schedule();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    if (pollTimer) clearTimeout(pollTimer);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    vv?.removeEventListener("resize", schedule);
    vv?.removeEventListener("scroll", schedule);
    mq.removeEventListener?.("change", schedule);
    scene.removeEventListener?.("renderstart", schedule);
    scene.removeEventListener?.("arReady", schedule);
  };
}

/* ------------------------------------------------------------------ */
/* Renderer tuning                                                     */
/* ------------------------------------------------------------------ */

/**
 * Two cheap but large wins on older phones:
 *
 * 1. devicePixelRatio cap. A 3x-DPR budget phone renders ~9x the fragments of
 *    a 1x canvas for zero perceptible gain over a live camera feed. A-Frame
 *    defaults to the full device ratio; we clamp it per tier.
 * 2. Stop the render loop while the tab/app is backgrounded. Otherwise the
 *    GPU keeps drawing, drains battery and is the usual trigger for the
 *    "context lost" black screen when the OS reclaims memory.
 */
export function applyRendererTuning(scene: any, tier: DeviceTier): () => void {
  if (typeof window === "undefined") return () => {};
  const cap = DPR_CAP[tier];

  const clamp = () => {
    try {
      const renderer = scene?.renderer;
      if (!renderer) return;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      if (Math.abs(renderer.getPixelRatio?.() - dpr) > 0.01) {
        renderer.setPixelRatio(dpr);
        scene.resize?.();
      }
    } catch {
      /* renderer torn down */
    }
  };

  scene?.addEventListener?.("renderstart", clamp);
  clamp();

  const onVis = () => {
    try {
      if (document.hidden) scene?.pause?.();
      else {
        scene?.play?.();
        clamp();
      }
    } catch {
      /* scene gone */
    }
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    scene?.removeEventListener?.("renderstart", clamp);
  };
}

/* ------------------------------------------------------------------ */
/* VR support                                                          */
/* ------------------------------------------------------------------ */

/** Feature-detect a real immersive-vr session (headset present). */
export async function isImmersiveVrSupported(): Promise<boolean> {
  try {
    const xr = (navigator as any)?.xr;
    if (!xr?.isSessionSupported) return false;
    return (await xr.isSessionSupported("immersive-vr")) === true;
  } catch {
    return false;
  }
}

/** Hard stop for any camera stream still held by the page. */
export function releaseCameraStreams(root: ParentNode = document) {
  root.querySelectorAll("video").forEach((video) => {
    const stream = (video as HTMLVideoElement).srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((t) => t.stop());
      (video as HTMLVideoElement).srcObject = null;
    }
  });
}
