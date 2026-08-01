import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getPublicExperience } from "@/lib/experiences.functions";
import { PinGate } from "@/components/PinGate";

import {
  attachWebglRecovery,
  hasWebglSupport,
  WEBGL_UNSUPPORTED_MESSAGE,
} from "@/lib/webgl-recovery";
import {
  AR_STAGE_CLASS,
  applySceneHygiene,
  attachArViewportFit,
  detectDeviceTier,
  ensureArStageStyles,
  isImmersiveVrSupported,
  mindarConfig,
  releaseCameraStreams,
  rendererConfig,
} from "@/lib/ar-runtime";
import { VrStage } from "@/components/ar/VrStage";


export const Route = createFileRoute("/ar/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "video" ? "video" as const : undefined,
    tok: typeof search.tok === "string" ? search.tok : undefined,
  }),
  loaderDeps: ({ search }) => ({ tok: search.tok }),
  loader: async ({ params, deps }) => {
    const row = await getPublicExperience({
      data: { slug: params.slug, tok: deps.tok ?? null },
    });
    if (!row) throw notFound();
    return { experience: row };
  },
  head: ({ loaderData }) => {
    const exp = loaderData?.experience;
    if (!exp) return { meta: [] };
    const description = exp.locked
      ? "This AR experience is private — enter the PIN printed on your card."
      : (exp.description ?? "View this AR experience");
    const cover = exp.locked ? null : exp.cover_image_url;
    return {
      meta: [
        { title: `${exp.title} — AR Experience` },
        { name: "description", content: description },
        { property: "og:title", content: exp.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(cover
          ? [
              { property: "og:image", content: cover },
              { name: "twitter:image", content: cover },
            ]
          : []),
      ],
    };
  },

  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-2xl font-serif italic mb-2">Couldn't load experience</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-3xl font-serif italic mb-2">Experience not found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This AR link doesn't exist or isn't published.
        </p>
        <Link to="/" className="text-primary hover:underline text-sm">
          ← Back to home
        </Link>
      </div>
    </div>
  ),
  component: ARViewer,
});

function ARViewer() {
  const { experience } = Route.useLoaderData();
  const [started, setStarted] = useState(false);
  const [forceFallback, setForceFallback] = useState(false);
  const [vrMode, setVrMode] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const locked = experience.locked === true;
  const hasMarker = "marker_url" in experience && !!experience.marker_url;

  const ensureEngine = useCallback(async () => {
    for (const src of MINDAR_SCRIPTS) await loadScript(src);
    await waitFor(() => typeof (window as any).AFRAME !== "undefined");
  }, []);

  // Feature-detect immersive VR once; the button never renders without it.
  useEffect(() => {
    let alive = true;
    void isImmersiveVrSupported().then((ok) => alive && setVrSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  // Preload MindAR scripts while user reads the intro — makes "Launch AR" feel instant.
  // NOTE: must run before any conditional return (React hooks rules).
  useEffect(() => {
    if (!hasMarker) return;
    // A-Frame must finish before MindAR evaluates and registers its component.
    void (async () => {
      for (const src of MINDAR_SCRIPTS) await loadScript(src);
    })().catch(() => {});
  }, [hasMarker]);


  // NOTE: we never play the media directly on this route. AR mode always opens
  // the camera (image tracking when a marker exists, plain camera preview otherwise).

  // Restricted content without a valid QR token: PIN wall, nothing else loads.
  if (experience.locked) {
    return (
      <PinGate kind="experience" slug={experience.slug ?? ""} title={experience.title} />
    );
  }


  return (

    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <Link
        to="/"
        className="absolute top-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs hover:bg-white/20"
      >
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      {!started ? (
        <div className="min-h-screen grid place-items-center p-6">
          <div className="max-w-md text-center">
            {experience.cover_image_url && (
              <img
                src={experience.cover_image_url}
                alt=""
                className="w-full aspect-video object-cover rounded-2xl mb-6"
              />
            )}
            <h1 className="text-3xl font-serif italic mb-2">{experience.title}</h1>
            {experience.description && (
              <p className="text-sm text-white/70 mb-6">{experience.description}</p>
            )}
            {experience.marker_image_url && (
              <div className="mb-6">
                <p className="text-xs text-white/50 mb-2">Point your camera at this marker:</p>
                <img
                  src={experience.marker_image_url}
                  alt="marker"
                  className="w-32 h-32 mx-auto rounded-md bg-white p-2 object-contain"
                />
              </div>
            )}
            <button
              onClick={() => setStarted(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-medium hover:bg-white/90"
            >
              <Camera className="h-4 w-4" />
              Launch AR
            </button>
            <p className="text-xs text-white/40 mt-4">
              Your camera stays on your device. {hasMarker
                ? "Point at the printed marker to see the AR content."
                : "Preview mode — no marker uploaded yet."}
            </p>
            {hasMarker && (
              <button
                onClick={() => { setForceFallback(true); setStarted(true); }}
                className="block mx-auto mt-3 text-xs text-white/40 hover:text-white/70 underline"
              >
                Having trouble? Use plain camera mode
              </button>
            )}
          </div>
        </div>
      ) : vrMode ? (
        /* AR stage is unmounted here: camera released + WebGL context disposed
           before the VR scene creates its own. No double context, no leak. */
        <VrStage
          mediaUrl={experience.media_url}
          mediaType={experience.media_type}
          loop={experience.loop_playback !== false}
          ensureEngine={ensureEngine}
          onExit={() => setVrMode(false)}
        />
      ) : (
        forceFallback || !hasMarker
          ? <PlainCameraFallback experience={experience} />
          : (
            <ARStage
              experience={experience}
              vrSupported={vrSupported}
              onEnterVr={() => setVrMode(true)}
            />
          )
      )}

    </div>
  );
}


// MindAR loads via CDN (its npm package pulls native gyp deps we don't need).
// We inject the A-Frame + MindAR scripts once, then mount the scene.
const MINDAR_SCRIPTS = [
  "https://aframe.io/releases/1.5.0/aframe.min.js",
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js",
];

function safeHttpsUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

const scriptPromises = new Map<string, Promise<void>>();
function loadScript(src: string) {
  const cached = scriptPromises.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${src}"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => {
        existing.dataset.loaded = "true";
        resolve();
      }, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "true";
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
  scriptPromises.set(src, p);
  p.catch(() => scriptPromises.delete(src));
  return p;
}

function waitFor(check: () => boolean, timeoutMs = 10000, intervalMs = 50) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - start > timeoutMs)
        return reject(new Error("Timed out waiting for AR engine"));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function ARStage({
  experience,
  vrSupported,
  onEnterVr,
}: {
  experience: any;
  vrSupported: boolean;
  onEnterVr: () => void;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const sceneElRef = useRef<any>(null);
  const attemptRef = useRef(0);
  const lastTapRef = useRef(0);

  const [status, setStatus] = useState<
    "loading" | "ready" | "no-marker" | "error"
  >("loading");
  const gpuAttemptsRef = useRef({ current: 0 });
  const detachRecoveryRef = useRef<null | (() => void)>(null);
  const detachFitRef = useRef<null | (() => void)>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<string | null>(null);

  const [tracking, setTracking] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [cinema, setCinema] = useState(false); // fullscreen video overlay

  const start = useCallback(async () => {
    attemptRef.current += 1;
    setStatus("loading");
    setErrorMsg(null);
    setRecovering(null);
    ensureArStageStyles();
    detachRecoveryRef.current?.();
    detachRecoveryRef.current = null;
    detachFitRef.current?.();
    detachFitRef.current = null;



    // No WebGL at all → skip the engine entirely and explain why.
    if (!hasWebglSupport()) {
      setErrorMsg(WEBGL_UNSUPPORTED_MESSAGE);
      setStatus("error");
      return;
    }

    try {

      const markerUrl = safeHttpsUrl(experience.marker_url);
      if (!markerUrl || !markerUrl.pathname.endsWith(".mind")) {
        setStatus("no-marker");
        return;
      }
      const mediaUrl = safeHttpsUrl(experience.media_url);

      for (const src of MINDAR_SCRIPTS) await loadScript(src);
      await waitFor(
        () =>
          typeof (window as any).AFRAME !== "undefined" &&
          !!(window as any).AFRAME?.components?.["mindar-image"],
      );
      if (!sceneRef.current) return;

      const root = sceneRef.current;
      try {
        sceneElRef.current?.systems?.["mindar-image-system"]?.stop?.();
      } catch {}
      root.replaceChildren();

      const tier = detectDeviceTier();
      const scenEl = document.createElement("a-scene");
      scenEl.setAttribute(
        "mindar-image",
        mindarConfig({ imageTargetSrc: markerUrl.href, tier, maxTrack: 1 }),
      );
      scenEl.setAttribute("renderer", rendererConfig(tier));
      applySceneHygiene(scenEl);
      // Sizing comes from the scoped `.ar-stage-root` stylesheet (100dvh),
      // not an inline 100vh which overshoots the visible viewport on mobile.


      const assets = document.createElement("a-assets");
      let videoEl: HTMLVideoElement | null = null;
      if (mediaUrl) {
        if (experience.media_type === "video") {
          const v = document.createElement("video");
          v.id = "ar-media";
          v.src = mediaUrl.href;
          v.preload = "auto";
          v.loop = experience.loop_playback !== false;
          v.muted = true;
          v.defaultMuted = true;
          v.autoplay = experience.autoplay !== false;
          v.playsInline = true;
          v.crossOrigin = "anonymous";
          v.setAttribute("muted", "");
          v.setAttribute("autoplay", "");
          v.setAttribute("playsinline", "");
          v.setAttribute("webkit-playsinline", "");
          assets.appendChild(v);
          videoEl = v;
        } else if (experience.media_type === "image") {
          const img = document.createElement("img");
          img.id = "ar-media";
          img.src = mediaUrl.href;
          img.crossOrigin = "anonymous";
          assets.appendChild(img);
        }
      }
      scenEl.appendChild(assets);

      const cam = document.createElement("a-camera");
      cam.setAttribute("position", "0 0 0");
      cam.setAttribute("look-controls", "enabled: false");
      scenEl.appendChild(cam);

      const target = document.createElement("a-entity");
      target.setAttribute("mindar-image-target", "targetIndex: 0");
      if (mediaUrl) {
        if (experience.media_type === "video") {
          const av = document.createElement("a-video");
          av.setAttribute("src", "#ar-media");
          av.setAttribute("webkit-playsinline", "");
          av.setAttribute("playsinline", "");
          av.setAttribute("autoplay", String(experience.autoplay !== false));
          av.setAttribute("loop", String(experience.loop_playback !== false));
          av.setAttribute("width", "1");
          av.setAttribute("height", "0.5625");
          av.setAttribute("position", "0 0 0");
          target.appendChild(av);
        } else if (experience.media_type === "image") {
          const ai = document.createElement("a-image");
          ai.setAttribute("src", "#ar-media");
          ai.setAttribute("width", "1");
          ai.setAttribute("height", "1");
          ai.setAttribute("position", "0 0 0");
          target.appendChild(ai);
        }
      }

      const onFound = () => {
        setTracking(true);
        if (experience.autoplay !== false) videoEl?.play().catch(() => {});
      };
      const onLost = () => {
        setTracking(false);
        videoEl?.pause();
      };
      target.addEventListener("targetFound", onFound);
      target.addEventListener("targetLost", onLost);
      scenEl.appendChild(target);

      root.appendChild(scenEl);
      sceneElRef.current = scenEl;
      videoElRef.current = videoEl;

      if (videoEl) {
        videoEl.addEventListener("play", () => setPlaying(true));
        videoEl.addEventListener("pause", () => setPlaying(false));
        videoEl.addEventListener("volumechange", () =>
          setMuted(videoEl!.muted),
        );
        const kick = () => {
          if (experience.autoplay !== false) videoEl!.play().catch(() => {});
        };
        scenEl.addEventListener("renderstart", kick, { once: true });
      }

      // Recover gracefully when the GPU drops the WebGL context (backgrounded
      // tab, thermal throttling, low memory). Restart the session a couple of
      // times, then fall back to a clear explanation instead of a black screen.
      detachRecoveryRef.current = attachWebglRecovery(scenEl, {
        attempts: gpuAttemptsRef.current,
        onLost: (message) => setRecovering(message),
        onRestore: () => start(),
        onFatal: (message) => {
          setRecovering(null);
          setErrorMsg(message);
          setStatus("error");
        },
      });
      // Keep canvas + projection + camera-feed transform locked to the visible
      // viewport on rotate / URL-bar collapse, and cap the camera track.
      detachFitRef.current = attachArViewportFit(scenEl, tier);

      // A session that survives 20s is considered healthy: forgive earlier
      // GPU hiccups so a long session isn't killed by old strikes.
      setTimeout(() => {
        if (sceneElRef.current === scenEl) gpuAttemptsRef.current.current = 0;
      }, 20_000);

      setStatus("ready");


    } catch (e: any) {
      // Auto-retry once before surfacing the error (transient CDN or camera race).
      if (attemptRef.current < 2) {
        setTimeout(() => start(), 500);
        return;
      }
      setErrorMsg(e?.message ?? "Failed to start AR");
      setStatus("error");
    }
  }, [experience]);

  useEffect(() => {
    start();
    return () => {
      detachRecoveryRef.current?.();
      detachRecoveryRef.current = null;
      detachFitRef.current?.();
      detachFitRef.current = null;
      try {
        sceneElRef.current?.systems?.["mindar-image-system"]?.stop?.();
        sceneElRef.current?.renderer?.dispose?.();
      } catch {}

      releaseCameraStreams();
      document
        .querySelectorAll("[data-mindar-image-camera], .mindar-ui-overlay, .mindar-ui-loading, .mindar-ui-scanning, .mindar-ui-compatibility")
        .forEach((element) => element.remove());
      if (sceneRef.current) sceneRef.current.replaceChildren();
      sceneElRef.current = null;
    };
  }, [start]);


  // Pause when tab hidden, resume on return.
  useEffect(() => {
    const onVis = () => {
      const v = videoElRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const togglePlay = () => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleMute = () => {
    const v = videoElRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const restart = () => {
    const v = videoElRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };
  const onSceneTap = () => {
    // Double-tap anywhere on the scene → cinema mode
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      setCinema((c) => !c);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  if (status === "error") {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div className="max-w-sm">
          <p className="text-lg mb-2">AR couldn't start</p>
          <p className="text-sm text-white/60 mb-6">{errorMsg}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                attemptRef.current = 0;
                gpuAttemptsRef.current.current = 0;
                start();
              }}
              className="rounded-full bg-white text-black px-5 py-2 text-sm font-medium"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border border-white/25 px-5 py-2 text-sm text-white/90"
            >
              Reload the page
            </button>
            <button
              onClick={() => setStatus("no-marker")}
              className="text-xs text-white/60 underline"
            >
              Use plain camera mode instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "no-marker")
    return <PlainCameraFallback experience={experience} />;

  return (
    <>
      {status === "loading" && (
        <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
          <div className="text-sm text-white/70 animate-pulse">
            Loading AR engine…
          </div>
        </div>
      )}

      {/* Transient GPU context-loss notice while the session restarts */}
      {recovering && (
        <div className="absolute inset-x-0 top-16 z-40 flex justify-center px-4 pointer-events-none">
          <div className="rounded-full bg-amber-500/20 text-amber-100 backdrop-blur px-4 py-2 text-xs text-center">
            {recovering}
          </div>
        </div>
      )}

      <div
        ref={sceneRef}
        onClick={onSceneTap}
        className={AR_STAGE_CLASS}
      />

      {/* VR entry — only rendered when a headset session is actually available */}
      {status === "ready" && vrSupported && (
        <button
          onClick={onEnterVr}
          className="absolute top-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-2 text-xs text-white hover:bg-white/20"
        >
          View in VR
        </button>
      )}


      {/* Tracking indicator */}
      {status === "ready" && (
        <div className="absolute top-4 inset-x-0 z-30 flex justify-center pointer-events-none">
          <div
            className={`inline-flex items-center gap-2 rounded-full backdrop-blur px-3 py-1.5 text-xs transition-colors ${
              tracking
                ? "bg-emerald-500/20 text-emerald-100"
                : "bg-white/10 text-white/80"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                tracking ? "bg-emerald-400" : "bg-white/60 animate-pulse"
              }`}
            />
            {tracking ? "Tracking marker" : "Point camera at the marker"}
          </div>
        </div>
      )}

      {/* Cinema mode: fullscreen video overlay while tracked or on demand */}
      {cinema && experience.media_type === "video" && experience.media_url && (
        <div
          className="fixed inset-0 z-40 bg-black flex items-center justify-center"
          onClick={() => setCinema(false)}
        >
          <video
            src={experience.media_url}
            autoPlay
            loop={experience.loop_playback !== false}
            playsInline
            muted={muted}
            controls
            className="max-w-full max-h-full"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCinema(false);
            }}
            className="absolute top-4 right-4 rounded-full bg-white/10 backdrop-blur p-2 text-white hover:bg-white/20"
            aria-label="Exit fullscreen"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Playback controls */}
      {status === "ready" && experience.media_type === "video" && (
        <div className="absolute bottom-4 inset-x-0 z-30 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-black/50 backdrop-blur px-2 py-1.5 text-white">
            <IconBtn label={playing ? "Pause" : "Play"} onClick={togglePlay}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </IconBtn>
            <IconBtn label="Restart" onClick={restart}>
              <RotateCcw className="h-4 w-4" />
            </IconBtn>
            <IconBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </IconBtn>
            <IconBtn
              label={cinema ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setCinema((c) => !c)}
            >
              {cinema ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconBtn>
          </div>
        </div>
      )}

      {/* Hint (auto-hides after tracking) */}
      {status === "ready" && !tracking && !cinema && (
        <div className="absolute bottom-20 inset-x-0 z-20 text-center pointer-events-none">
          <p className="text-[11px] text-white/50">
            Double-tap the video to expand
          </p>
        </div>
      )}
    </>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid place-items-center h-9 w-9 rounded-full hover:bg-white/10 active:bg-white/20"
    >
      {children}
    </button>
  );
}

function PlainCameraFallback({ experience }: { experience: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error)
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div>
          <p className="text-lg mb-2">Camera access needed</p>
          <p className="text-sm text-white/60">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="relative min-h-screen">
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      {experience.media_url && experience.media_type === "video" && (
        <video
          src={experience.media_url}
          autoPlay={experience.autoplay !== false}
          loop={experience.loop_playback !== false}
          muted
          playsInline
          className="absolute inset-x-8 bottom-20 max-w-md mx-auto rounded-2xl shadow-2xl opacity-95"
        />
      )}
      {experience.media_url && experience.media_type === "image" && (
        <img
          src={experience.media_url}
          alt=""
          className="absolute inset-x-8 bottom-20 max-w-md mx-auto rounded-2xl shadow-2xl opacity-95"
        />
      )}
      <div className="absolute bottom-6 inset-x-0 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-2 text-xs">
          Preview mode — upload a compiled <code className="font-mono">.mind</code> marker for tracking
        </div>
      </div>
    </div>
  );
}
