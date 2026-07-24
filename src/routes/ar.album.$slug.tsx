import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Download,
  Expand,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getPublicAlbum } from "@/lib/albums.functions";
import { logScanEvent } from "@/lib/analytics.functions";


export const Route = createFileRoute("/ar/album/$slug")({
  loader: async ({ params }) => {
    const album = await getPublicAlbum({ data: { slug: params.slug } });
    if (!album) throw notFound();
    return { album };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.album.title} — AR Album` },
          {
            name: "description",
            content: `Scan once, then point your camera at any photo in ${loaderData.album.title} to watch it come alive.`,
          },
          { property: "og:title", content: `${loaderData.album.title} — AR Album` },
          {
            property: "og:description",
            content: "Point your camera at any photo in this album to play its video.",
          },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [
          { title: "Album unavailable" },
          { name: "robots", content: "noindex" },
        ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-2xl font-serif italic mb-2">Couldn't load album</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-3xl font-serif italic mb-2">Album not found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This album link doesn't exist or isn't published.
        </p>
        <Link to="/" className="text-primary hover:underline text-sm">
          ← Back to home
        </Link>
      </div>
    </div>
  ),
  component: AlbumViewer,
});

const MINDAR_SCRIPTS = [
  "https://aframe.io/releases/1.5.0/aframe.min.js",
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js",
];

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
      existing.addEventListener(
        "load",
        () => {
          existing.dataset.loaded = "true";
          resolve();
        },
        { once: true },
      );
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

function waitFor(check: () => boolean, timeoutMs = 12000, intervalMs = 50) {
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

function safeHttpsUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function newSessionId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function AlbumViewer() {
  const { album } = Route.useLoaderData();
  const [started, setStarted] = useState(false);
  const sessionRef = useRef<string>("");
  if (!sessionRef.current) sessionRef.current = newSessionId();

  useEffect(() => {
    void (async () => {
      for (const src of MINDAR_SCRIPTS) await loadScript(src);
    })().catch(() => {});
  }, []);

  const track = useCallback(
    (
      event_type:
        | "album_open"
        | "target_found"
        | "playback_start"
        | "playback_complete"
        | "recognition_timeout",
      extra?: { target_index?: number | null; duration_ms?: number | null },
    ) => {
      void logScanEvent({
        data: {
          album_id: album.id,
          target_index: extra?.target_index ?? null,
          event_type,
          session_id: sessionRef.current,
          duration_ms: extra?.duration_ms ?? null,
        },
      }).catch(() => {});
    },
    [album.id],
  );

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
            <h1 className="text-3xl font-serif italic mb-2">{album.title}</h1>
            <p className="text-sm text-white/70 mb-6">
              Scan complete. Now just point your camera at any photo in this
              album — {album.target_count} photo
              {album.target_count === 1 ? "" : "s"} are recognised, and each one
              plays its own video. No need to scan again.
            </p>
            <button
              onClick={() => {
                track("album_open");
                setStarted(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-medium hover:bg-white/90"
            >
              <Camera className="h-4 w-4" /> Open camera
            </button>
            <p className="text-xs text-white/40 mt-4">
              Your camera stays on your device.
            </p>
          </div>
        </div>
      ) : (
        <AlbumStage album={album} track={track} />
      )}
    </div>
  );
}

type TrackFn = (
  event_type:
    | "album_open"
    | "target_found"
    | "playback_start"
    | "playback_complete"
    | "recognition_timeout",
  extra?: { target_index?: number | null; duration_ms?: number | null },
) => void;

function AlbumStage({ album, track }: { album: any; track: TrackFn }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const sceneElRef = useRef<any>(null);
  const videosRef = useRef<Record<number, HTMLVideoElement>>({});
  const attemptRef = useRef(0);
  const lastTapRef = useRef(0);
  const primedRef = useRef(false);
  const readyAtRef = useRef<number>(Date.now());
  const completedRef = useRef<Record<number, boolean>>({});
  const startedRef = useRef<Record<number, boolean>>({});

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [cinema, setCinema] = useState(false);
  const [fitContain, setFitContain] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [everFound, setEverFound] = useState(false);
  const [primed, setPrimed] = useState(false);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);

  const activeTarget =
    activeIndex === null
      ? null
      : album.targets.find((t: any) => t.target_index === activeIndex) ?? null;

  /**
   * iOS Safari only allows media playback that originates from a user gesture.
   * Priming every video once (play → immediate pause) inside a real tap makes
   * later programmatic play() calls on target detection succeed.
   */
  const primeVideos = useCallback(async () => {
    if (primedRef.current) return;
    primedRef.current = true;
    const vids = Object.values(videosRef.current);
    await Promise.all(
      vids.map(async (v) => {
        try {
          v.muted = true;
          const p = v.play();
          if (p) await p;
          v.pause();
          v.currentTime = 0;
        } catch {
          /* ignore — we retry on first targetFound */
        }
      }),
    );
    setPrimed(true);
  }, []);

  const playVideo = useCallback(
    async (v: HTMLVideoElement, index: number) => {
      try {
        await v.play();
        setNeedsTapToPlay(false);
      } catch {
        // Fallback 1: force muted inline playback (iOS low-power mode).
        try {
          v.muted = true;
          v.setAttribute("muted", "");
          v.playsInline = true;
          await v.play();
          setMuted(true);
          setNeedsTapToPlay(false);
        } catch {
          // Fallback 2: ask the user for an explicit tap.
          setNeedsTapToPlay(true);
          setActiveIndex(index);
        }
      }
    },
    [],
  );

  const start = useCallback(async () => {
    attemptRef.current += 1;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const mindUrl = safeHttpsUrl(album.compiled_mind_url);
      if (!mindUrl) throw new Error("This album has no compiled AR marker yet");

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
      videosRef.current = {};

      const scene = document.createElement("a-scene");
      scene.setAttribute(
        "mindar-image",
        `imageTargetSrc: ${mindUrl.href}; autoStart: true; uiScanning: no; uiLoading: no; uiError: no; maxTrack: 1; filterMinCF: 0.0001; filterBeta: 0.01; warmupTolerance: 5; missTolerance: 5;`,
      );
      scene.setAttribute("color-space", "sRGB");
      scene.setAttribute(
        "renderer",
        "colorManagement: true, physicallyCorrectLights: true, antialias: false, precision: mediump",
      );
      scene.setAttribute("vr-mode-ui", "enabled: false");
      scene.setAttribute("device-orientation-permission-ui", "enabled: false");
      scene.setAttribute("embedded", "");
      scene.style.width = "100%";
      scene.style.height = "100vh";

      const assets = document.createElement("a-assets");
      for (const t of album.targets) {
        const mediaUrl = safeHttpsUrl(t.media_url);
        if (!mediaUrl || t.media_type !== "video") continue;
        const v = document.createElement("video");
        v.id = `ar-media-${t.target_index}`;
        v.src = mediaUrl.href;
        // Only the tracked target's video is fetched eagerly.
        v.preload = "metadata";
        v.loop = t.loop_playback !== false;
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        v.crossOrigin = "anonymous";
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        assets.appendChild(v);
        videosRef.current[t.target_index] = v;
      }
      scene.appendChild(assets);

      const cam = document.createElement("a-camera");
      cam.setAttribute("position", "0 0 0");
      cam.setAttribute("look-controls", "enabled: false");
      scene.appendChild(cam);

      for (const t of album.targets) {
        const entity = document.createElement("a-entity");
        entity.setAttribute(
          "mindar-image-target",
          `targetIndex: ${t.target_index}`,
        );
        if (safeHttpsUrl(t.media_url) && t.media_type === "video") {
          const av = document.createElement("a-video");
          av.setAttribute("src", `#ar-media-${t.target_index}`);
          av.setAttribute("playsinline", "");
          av.setAttribute("webkit-playsinline", "");
          av.setAttribute("loop", String(t.loop_playback !== false));
          av.setAttribute("width", "1");
          av.setAttribute("height", "0.5625");
          av.setAttribute("position", "0 0 0");
          entity.appendChild(av);
        }

        entity.addEventListener("targetFound", () => {
          setActiveIndex(t.target_index);
          setEverFound(true);
          setShowHelp(false);
          track("target_found", {
            target_index: t.target_index,
            duration_ms: Math.max(0, Date.now() - readyAtRef.current),
          });
          const v = videosRef.current[t.target_index];
          if (v && t.autoplay !== false) {
            v.currentTime = 0;
            void playVideo(v, t.target_index);
          }
        });
        entity.addEventListener("targetLost", () => {
          videosRef.current[t.target_index]?.pause();
          setActiveIndex((cur) => (cur === t.target_index ? null : cur));
        });

        scene.appendChild(entity);
      }

      for (const [key, v] of Object.entries(videosRef.current)) {
        const index = Number(key);
        v.addEventListener("play", () => {
          setPlaying(true);
          if (!startedRef.current[index]) {
            startedRef.current[index] = true;
            track("playback_start", { target_index: index });
          }
        });
        v.addEventListener("pause", () => setPlaying(false));
        v.addEventListener("volumechange", () => setMuted(v.muted));
        v.addEventListener("ended", () => {
          if (completedRef.current[index]) return;
          completedRef.current[index] = true;
          track("playback_complete", { target_index: index });
        });
        // Looping videos never fire "ended" — count 95% watched as complete.
        v.addEventListener("timeupdate", () => {
          if (completedRef.current[index] || !v.duration || !isFinite(v.duration))
            return;
          if (v.currentTime / v.duration >= 0.95) {
            completedRef.current[index] = true;
            track("playback_complete", {
              target_index: index,
              duration_ms: Math.round(v.currentTime * 1000),
            });
          }
        });
      }

      scene.addEventListener("webglcontextlost", (e: any) => {
        e.preventDefault?.();
        setErrorMsg("Graphics context lost — reloading engine");
        setTimeout(() => start(), 300);
      });

      root.appendChild(scene);
      sceneElRef.current = scene;
      readyAtRef.current = Date.now();
      setStatus("ready");
    } catch (e: any) {
      if (attemptRef.current < 2) {
        setTimeout(() => start(), 500);
        return;
      }
      setErrorMsg(e?.message ?? "Failed to start AR");
      setStatus("error");
    }
  }, [album, playVideo, track]);

  useEffect(() => {
    start();
    return () => {
      try {
        sceneElRef.current?.systems?.["mindar-image-system"]?.stop?.();
      } catch {}
      document.querySelectorAll("video").forEach((video) => {
        const stream = video.srcObject;
        if (stream instanceof MediaStream) {
          stream.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
      });
      document
        .querySelectorAll(
          "[data-mindar-image-camera], .mindar-ui-overlay, .mindar-ui-loading, .mindar-ui-scanning, .mindar-ui-compatibility",
        )
        .forEach((el) => el.remove());
      if (sceneRef.current) sceneRef.current.replaceChildren();
    };
  }, [start]);

  // Graceful degradation: if nothing is recognised within 8s, coach the user.
  useEffect(() => {
    if (status !== "ready" || everFound) return;
    const t = setTimeout(() => {
      setShowHelp(true);
      track("recognition_timeout");
    }, 8000);
    return () => clearTimeout(t);
  }, [status, everFound, track]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) return;
      Object.values(videosRef.current).forEach((v) => v.pause());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const activeVideo =
    activeIndex === null ? null : videosRef.current[activeIndex] ?? null;

  const togglePlay = () => {
    if (!activeVideo || activeIndex === null) return;
    if (activeVideo.paused) void playVideo(activeVideo, activeIndex);
    else activeVideo.pause();
  };
  const toggleMute = () => {
    if (!activeVideo) return;
    activeVideo.muted = !activeVideo.muted;
    setMuted(activeVideo.muted);
  };
  const restart = () => {
    if (!activeVideo || activeIndex === null) return;
    activeVideo.currentTime = 0;
    void playVideo(activeVideo, activeIndex);
  };
  const onSceneTap = () => {
    void primeVideos();
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      if (activeTarget) setCinema((c) => !c);
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
          <button
            onClick={() => {
              attemptRef.current = 0;
              start();
            }}
            className="rounded-full bg-white text-black px-5 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === "loading" && (
        <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
          <div className="text-sm text-white/70 animate-pulse">
            Loading AR engine…
          </div>
        </div>
      )}

      <div ref={sceneRef} onClick={onSceneTap} className="absolute inset-0" />

      {status === "ready" && !primed && (
        <div className="absolute inset-x-0 bottom-28 z-30 flex justify-center px-6">
          <button
            onClick={() => void primeVideos()}
            className="rounded-full bg-white text-black px-5 py-2.5 text-sm font-medium shadow-lg"
          >
            Tap once to enable video
          </button>
        </div>
      )}

      {status === "ready" && needsTapToPlay && activeTarget && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/40">
          <button
            onClick={() => {
              if (activeVideo && activeIndex !== null)
                void playVideo(activeVideo, activeIndex);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-medium"
          >
            <Play className="h-4 w-4" /> Tap to play
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="absolute top-4 inset-x-0 z-30 flex justify-center pointer-events-none px-14">
          <div
            className={`inline-flex items-center gap-2 rounded-full backdrop-blur px-3 py-1.5 text-xs transition-colors ${
              activeTarget
                ? "bg-emerald-500/20 text-emerald-100"
                : "bg-white/10 text-white/80"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeTarget ? "bg-emerald-400" : "bg-white/60 animate-pulse"
              }`}
            />
            <span className="truncate">
              {activeTarget
                ? activeTarget.title
                : "Point your camera at any photo in the album"}
            </span>
          </div>
        </div>
      )}

      {status === "ready" && showHelp && !activeTarget && (
        <div className="absolute top-16 inset-x-0 z-30 flex justify-center px-6 pointer-events-none">
          <p className="rounded-xl bg-black/60 backdrop-blur px-4 py-2 text-center text-[11px] text-white/80">
            Having trouble recognising the photo? Try better lighting, fill more
            of the frame with the photo, and hold steady.
          </p>
        </div>
      )}

      {cinema && activeTarget?.media_url && (
        <div className="fixed inset-0 z-40 bg-black flex items-center justify-center">
          <video
            src={activeTarget.media_url}
            autoPlay
            loop={activeTarget.loop_playback !== false}
            playsInline
            muted={muted}
            controls
            className={`w-full h-full ${fitContain ? "object-contain" : "object-cover"}`}
          />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <a
              href={activeTarget.media_url}
              download={`${activeTarget.title ?? "aether-ar"}.mp4`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Download video"
              className="grid place-items-center h-9 w-9 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFitContain((f) => !f);
              }}
              aria-label={fitContain ? "Fill screen" : "Fit to screen"}
              className="grid place-items-center h-9 w-9 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
            >
              <Expand className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCinema(false);
              }}
              className="grid place-items-center h-9 w-9 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
              aria-label="Exit fullscreen"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {status === "ready" && activeTarget && (
        <div className="absolute bottom-4 inset-x-0 z-30 flex justify-center px-4">
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
              label={cinema ? "Exit fit to screen" : "Fit to screen"}
              onClick={() => setCinema((c) => !c)}
            >
              {cinema ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconBtn>
            {activeTarget.media_url && (
              <a
                href={activeTarget.media_url}
                download={`${activeTarget.title ?? "aether-ar"}.mp4`}
                target="_blank"
                rel="noreferrer"
                aria-label="Download video"
                className="grid place-items-center h-9 w-9 rounded-full hover:bg-white/10 active:bg-white/20"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {status === "ready" && activeTarget && !cinema && (
        <div className="absolute bottom-20 inset-x-0 z-20 text-center pointer-events-none">
          <p className="text-[11px] text-white/50">
            Double-tap the video to fit it to your screen
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

