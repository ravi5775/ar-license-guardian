/**
 * Aether AR runtime — the shared, tuned MindAR + A-Frame layer.
 *
 * Everything here exists because MindAR/A-Frame size themselves ONCE, from the
 * container box that existed at `renderstart`, and never truly re-derive the
 * camera-feed transform, the WebGL drawing buffer, or the projection aspect
 * after that. A CSS-only fix re-breaks on every rotation. So we own:
 *
 *   1. the visual viewport (real px height, notch-safe, no pinch zoom)
 *   2. the camera source resolution (constraint shim around getUserMedia)
 *   3. the renderer size / pixel ratio / projection aspect on every resize
 *   4. the MindAR feed "object-fit: cover" math in *layout* space, not CSS
 *   5. the overlay plane geometry, derived from marker AND media aspect
 */

/* ------------------------------------------------------------------ *
 * Device tiering
 * ------------------------------------------------------------------ */

export type DeviceTier = "low" | "mid" | "high";

export function getDeviceTier(): DeviceTier {
  if (typeof navigator === "undefined") return "mid";
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as any).deviceMemory ?? 4;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  if (cores <= 4 || mem <= 3) return "low";
  if (cores >= 8 && mem >= 6 && dpr <= 3) return "high";
  return "mid";
}

type TierProfile = {
  /** camera capture size handed to getUserMedia */
  capture: { width: number; height: number; fps: number };
  /** hard cap on the WebGL drawing buffer scale */
  maxPixelRatio: number;
  /** one-euro filter: lower = smoother, higher = twitchier */
  filterMinCF: number;
  filterBeta: number;
  warmupTolerance: number;
  missTolerance: number;
};

const PROFILES: Record<DeviceTier, TierProfile> = {
  low: {
    capture: { width: 640, height: 480, fps: 30 },
    maxPixelRatio: 1,
    filterMinCF: 0.00005,
    filterBeta: 0.003,
    warmupTolerance: 1,
    missTolerance: 6,
  },
  mid: {
    capture: { width: 960, height: 540, fps: 30 },
    maxPixelRatio: 1.25,
    filterMinCF: 0.0001,
    filterBeta: 0.008,
    warmupTolerance: 1,
    missTolerance: 5,
  },
  high: {
    capture: { width: 1280, height: 720, fps: 30 },
    maxPixelRatio: 1.5,
    filterMinCF: 0.0002,
    filterBeta: 0.02,
    warmupTolerance: 1,
    missTolerance: 5,
  },
};

export function getProfile(tier: DeviceTier = getDeviceTier()): TierProfile {
  return PROFILES[tier];
}

/* ------------------------------------------------------------------ *
 * Scene attribute builders
 * ------------------------------------------------------------------ */

export function mindarAttr(
  imageTargetSrc: string,
  opts: { maxTrack?: number; tier?: DeviceTier } = {},
) {
  const p = getProfile(opts.tier);
  return [
    `imageTargetSrc: ${imageTargetSrc}`,
    "autoStart: true",
    "uiScanning: no",
    "uiLoading: no",
    "uiError: no",
    `maxTrack: ${opts.maxTrack ?? 1}`,
    `filterMinCF: ${p.filterMinCF}`,
    `filterBeta: ${p.filterBeta}`,
    `warmupTolerance: ${p.warmupTolerance}`,
    `missTolerance: ${p.missTolerance}`,
  ].join("; ");
}

export function rendererAttr(tier: DeviceTier = getDeviceTier()) {
  const p = PROFILES[tier];
  return [
    "colorManagement: true",
    "physicallyCorrectLights: false",
    "antialias: false",
    `precision: ${tier === "high" ? "highp" : "mediump"}`,
    "sortObjects: false",
    "logarithmicDepthBuffer: false",
    "alpha: true",
    `maxCanvasWidth: ${p.capture.width * 2}`,
    `maxCanvasHeight: ${p.capture.width * 2}`,
  ].join(", ");
}

/**
 * Strips every A-Frame system/component we never use. Each one costs a tick
 * per frame even when idle — on a 4-core phone that is real milliseconds.
 */
export function applyLeanSceneFlags(scene: HTMLElement) {
  scene.setAttribute("embedded", "");
  scene.setAttribute("vr-mode-ui", "enabled: false");
  scene.setAttribute("ar-mode-ui", "enabled: false");
  scene.setAttribute("device-orientation-permission-ui", "enabled: false");
  scene.setAttribute("keyboard-shortcuts", "enterVR: false; enterAR: false");
  scene.setAttribute("shadow", "enabled: false");
  scene.setAttribute("stats", "false");
  scene.setAttribute("raycaster", "enabled: false");
  scene.setAttribute("pool", "");
  scene.setAttribute("color-space", "sRGB");
}

export function leanCamera(doc: Document = document) {
  const cam = doc.createElement("a-camera");
  cam.setAttribute("position", "0 0 0");
  cam.setAttribute("look-controls", "enabled: false");
  cam.setAttribute("wasd-controls", "enabled: false");
  cam.setAttribute("cursor", "rayOrigin: mouse; fuse: false");
  cam.setAttribute("raycaster", "enabled: false");
  return cam;
}

/* ------------------------------------------------------------------ *
 * 1. Viewport lock (notch/foldable/URL-bar safe)
 * ------------------------------------------------------------------ */

/**
 * Mobile Safari's `100vh` is the *large* viewport (URL bar hidden) so an
 * A-Frame scene sized with it is taller than what you can see — the bottom of
 * the camera feed is pushed off-screen. We drive a real pixel height from
 * visualViewport and expose it as `--ar-vh`.
 */
export function installViewportLock(): () => void {
  if (typeof document === "undefined") return () => {};

  const meta = document.querySelector('meta[name="viewport"]');
  const prev = meta?.getAttribute("content") ?? null;
  meta?.setAttribute(
    "content",
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
  );

  const prevOverflow = document.documentElement.style.overflow;
  const prevBodyOverscroll = document.body.style.overscrollBehavior;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";

  const apply = () => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--ar-vh", `${h}px`);
  };
  apply();
  window.visualViewport?.addEventListener("resize", apply);
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);

  return () => {
    window.visualViewport?.removeEventListener("resize", apply);
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
    if (prev !== null) meta?.setAttribute("content", prev);
    document.documentElement.style.overflow = prevOverflow;
    document.body.style.overscrollBehavior = prevBodyOverscroll;
    document.documentElement.style.removeProperty("--ar-vh");
  };
}

/* ------------------------------------------------------------------ *
 * 2. Camera capture constraint shim
 * ------------------------------------------------------------------ */

/**
 * MindAR calls getUserMedia itself with only `facingMode: environment`, so
 * phones hand it a 1080p/4K stream and every tracking frame pays for it.
 * We wrap getUserMedia for the lifetime of the session and merge in a capped
 * capture size — the single biggest CPU win available in this stack.
 */
export function installCaptureConstraints(tier: DeviceTier = getDeviceTier()) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return () => {};
  const md = navigator.mediaDevices;
  const original = md.getUserMedia.bind(md);
  const p = PROFILES[tier].capture;

  md.getUserMedia = ((constraints: MediaStreamConstraints = {}) => {
    if (constraints.video) {
      const v = typeof constraints.video === "object" ? constraints.video : {};
      constraints = {
        ...constraints,
        video: {
          facingMode: "environment",
          ...v,
          width: { ideal: p.width, max: 1920 },
          height: { ideal: p.height, max: 1080 },
          frameRate: { ideal: p.fps, max: p.fps },
        },
      };
    }
    return original(constraints);
  }) as typeof md.getUserMedia;

  return () => {
    md.getUserMedia = original;
  };
}

/* ------------------------------------------------------------------ *
 * 3 + 4. Resize governor
 * ------------------------------------------------------------------ */

function findFeedVideo(root: ParentNode): HTMLVideoElement | null {
  const all = Array.from(
    (root.ownerDocument ?? document).querySelectorAll("video"),
  ) as HTMLVideoElement[];
  return all.find((v) => v.srcObject instanceof MediaStream) ?? null;
}

/**
 * Re-derives EVERY size-dependent value after any viewport change:
 * drawing buffer, pixel ratio, projection aspect, and the camera feed's
 * cover transform. Runs on a settle schedule because iOS fires
 * `orientationchange` *before* layout has the new box.
 */
export function attachResizeGovernor(
  sceneEl: any,
  opts: { tier?: DeviceTier } = {},
) {
  const tier = opts.tier ?? getDeviceTier();
  const maxDpr = PROFILES[tier].maxPixelRatio;
  let raf = 0;
  const timers: number[] = [];

  const sync = () => {
    if (!sceneEl?.isConnected) return;
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    if (!w || !h) return;

    // DOM box first — A-Frame's own resize reads from it.
    sceneEl.style.width = `${w}px`;
    sceneEl.style.height = `${h}px`;
    const parent = sceneEl.parentElement as HTMLElement | null;
    if (parent) parent.style.height = `${h}px`;

    const renderer = sceneEl.renderer;
    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
      renderer.setSize(w, h, false);
      const canvas = renderer.domElement as HTMLCanvasElement;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const cam = sceneEl.camera;
    if (cam && "aspect" in cam) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }

    // Let MindAR recompute its own projection if it exposes a resize hook…
    const sys = sceneEl.systems?.["mindar-image-system"];
    try {
      sys?._resize?.();
    } catch {
      /* version drift — our own math below still applies */
    }

    // …then enforce object-fit: cover in *layout* space. CSS object-fit does
    // not move MindAR's projection, so the feed and the overlay would drift.
    const feed = findFeedVideo(document);
    if (feed?.videoWidth && feed.videoHeight) {
      const scale = Math.max(w / feed.videoWidth, h / feed.videoHeight);
      const vw = feed.videoWidth * scale;
      const vh = feed.videoHeight * scale;
      feed.style.position = "absolute";
      feed.style.top = "0px";
      feed.style.left = "0px";
      feed.style.width = `${vw}px`;
      feed.style.height = `${vh}px`;
      feed.style.marginLeft = `${(w - vw) / 2}px`;
      feed.style.marginTop = `${(h - vh) / 2}px`;
      feed.style.objectFit = "cover";
    }
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(sync);
    // iOS reports stale metrics on the first tick after rotation.
    [80, 250, 600].forEach((d) => timers.push(window.setTimeout(sync, d)));
  };

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  sceneEl.addEventListener?.("renderstart", schedule);
  sceneEl.addEventListener?.("arReady", schedule);
  schedule();

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
  };
}

/* ------------------------------------------------------------------ *
 * 5. Overlay plane geometry
 * ------------------------------------------------------------------ */

/** Loads just enough of an image to read its intrinsic aspect ratio. */
export function measureImageAspect(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () =>
      resolve(img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * MindAR's target space is: width = 1, height = 1 / markerAspect.
 * A hardcoded 1 x 0.5625 plane therefore overflows or crops on any marker that
 * isn't 16:9 — that is the "video doesn't fit the photo" bug, and no CSS can
 * reach it because it lives in the 3D scene graph.
 */
export function fitPlaneToMarker(
  markerAspect: number | null,
  mediaAspect: number | null,
  mode: "contain" | "cover" = "contain",
): { width: number; height: number } {
  const ma = markerAspect && markerAspect > 0 ? markerAspect : 1;
  const va = mediaAspect && mediaAspect > 0 ? mediaAspect : ma;
  const boxW = 1;
  const boxH = 1 / ma;

  const scale =
    mode === "cover"
      ? Math.max(boxW / va, boxH) // fill the print, crop the film
      : Math.min(boxW / va, boxH); // show the whole film inside the print

  const height = scale;
  const width = height * va;
  return { width: round3(width), height: round3(height) };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Reads a video's intrinsic aspect as soon as metadata lands. */
export function videoAspect(v: HTMLVideoElement): Promise<number | null> {
  if (v.videoWidth && v.videoHeight) {
    return Promise.resolve(v.videoWidth / v.videoHeight);
  }
  return new Promise((resolve) => {
    const done = () =>
      resolve(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : null);
    v.addEventListener("loadedmetadata", done, { once: true });
    v.addEventListener("error", () => resolve(null), { once: true });
    window.setTimeout(() => resolve(null), 6000);
  });
}

/**
 * Applies the fitted geometry to an <a-video>/<a-image> plane. Safe to call
 * repeatedly — A-Frame reuses the geometry, no material re-instantiation.
 */
export function applyPlaneFit(
  plane: Element,
  markerAspect: number | null,
  mediaAspect: number | null,
  mode: "contain" | "cover" = "contain",
) {
  const { width, height } = fitPlaneToMarker(markerAspect, mediaAspect, mode);
  plane.setAttribute("width", String(width));
  plane.setAttribute("height", String(height));
  plane.setAttribute("position", "0 0 0.001");
}
