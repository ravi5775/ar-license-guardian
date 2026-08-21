/**
 * WebGL context-loss recovery helpers for the AR viewers.
 *
 * Mobile GPUs drop the WebGL context aggressively: backgrounding the tab,
 * a phone call, thermal throttling or another heavy tab can all kill it.
 * When that happens A-Frame/MindAR keeps its DOM but renders nothing —
 * the user sees a frozen or black screen with no error.
 *
 * These helpers turn that silent failure into either an automatic session
 * restart or, when the GPU keeps failing, a clear human-readable fallback.
 */

export const WEBGL_LOST_MESSAGE = "Your device paused 3D rendering — restarting the AR session…";

export const WEBGL_FATAL_MESSAGE =
  "Your device's graphics engine keeps dropping the AR session. This usually means the phone is low on memory or too hot. Close other apps or tabs, then try again — or use plain camera mode.";

export const WEBGL_UNSUPPORTED_MESSAGE =
  "This browser can't run 3D graphics (WebGL is unavailable). Try Chrome on Android or Safari on iOS, and make sure hardware acceleration isn't disabled.";

/** True when the browser can actually hand out a WebGL context. */
export function hasWebglSupport(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export type WebglRecoveryOptions = {
  /** Shared counter so repeated losses across restarts still escalate. */
  attempts: { current: number };
  /** Surface a transient "recovering" notice. */
  onLost: (message: string) => void;
  /** Rebuild the AR session from scratch. */
  onRestore: () => void;
  /** Give up: show the fallback screen. */
  onFatal: (message: string) => void;
  /** How many automatic recoveries to attempt before falling back. */
  maxAttempts?: number;
};

/**
 * Attach context-loss listeners to an A-Frame scene element (and its canvas
 * once it exists). Returns a cleanup function.
 */
export function attachWebglRecovery(
  sceneEl: HTMLElement,
  { attempts, onLost, onRestore, onFatal, maxAttempts = 2 }: WebglRecoveryOptions,
): () => void {
  let disposed = false;
  let restoreTimer: ReturnType<typeof setTimeout> | null = null;
  const targets = new Set<EventTarget>();

  const handleLost = (event: Event) => {
    // preventDefault() is required for the browser to ever fire
    // webglcontextrestored / allow a new context on the same canvas.
    event.preventDefault?.();
    if (disposed) return;

    attempts.current += 1;
    if (attempts.current > maxAttempts) {
      onFatal(WEBGL_FATAL_MESSAGE);
      return;
    }

    onLost(WEBGL_LOST_MESSAGE);
    if (restoreTimer) clearTimeout(restoreTimer);
    // Back off a little more each time so we don't fight a throttling GPU.
    restoreTimer = setTimeout(() => {
      if (!disposed) onRestore();
    }, 400 * attempts.current);
  };

  const handleCreationError = () => {
    if (disposed) return;
    onFatal(hasWebglSupport() ? WEBGL_FATAL_MESSAGE : WEBGL_UNSUPPORTED_MESSAGE);
  };

  const bind = (target: EventTarget) => {
    if (targets.has(target)) return;
    targets.add(target);
    target.addEventListener("webglcontextlost", handleLost as EventListener);
    target.addEventListener("webglcontextcreationerror", handleCreationError as EventListener);
  };

  bind(sceneEl);

  // The canvas is created asynchronously by A-Frame; poll briefly for it.
  let polls = 0;
  const findCanvas = () => {
    if (disposed) return;
    const canvas = sceneEl.querySelector("canvas");
    if (canvas) {
      bind(canvas);
      return;
    }
    if (polls++ < 40) setTimeout(findCanvas, 250);
  };
  findCanvas();

  return () => {
    disposed = true;
    if (restoreTimer) clearTimeout(restoreTimer);
    targets.forEach((target) => {
      target.removeEventListener("webglcontextlost", handleLost as EventListener);
      target.removeEventListener("webglcontextcreationerror", handleCreationError as EventListener);
    });
    targets.clear();
  };
}
