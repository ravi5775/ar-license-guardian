import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera } from "lucide-react";
import { getPublicExperience } from "@/lib/experiences.functions";

export const Route = createFileRoute("/ar/$slug")({
  loader: async ({ params }) => {
    const row = await getPublicExperience({ data: { slug: params.slug } });
    if (!row) throw notFound();
    return { experience: row };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.experience.title} — AR Experience` },
          {
            name: "description",
            content: loaderData.experience.description ?? "View this AR experience",
          },
          { property: "og:title", content: loaderData.experience.title },
          {
            property: "og:description",
            content: loaderData.experience.description ?? "View this AR experience",
          },
          ...(loaderData.experience.cover_image_url
            ? [
                { property: "og:image", content: loaderData.experience.cover_image_url },
                { name: "twitter:image", content: loaderData.experience.cover_image_url },
              ]
            : []),
        ]
      : [],
  }),
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
  const hasMarker = !!experience.marker_url && experience.marker_url.endsWith(".mind");

  // Preload MindAR scripts while user reads the intro — makes "Launch AR" feel instant.
  useEffect(() => {
    if (!hasMarker) return;
    MINDAR_SCRIPTS.forEach((src) => {
      loadScript(src).catch(() => {});
    });
  }, [hasMarker]);

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
      ) : (
        forceFallback
          ? <PlainCameraFallback experience={experience} />
          : <ARStage experience={experience} />
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

function ARStage({ experience }: { experience: any }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no-marker" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let scene: any = null;
    let mounted = true;

    (async () => {
      try {
        const markerUrl = safeHttpsUrl(experience.marker_url);
        // Fall back to plain camera if no compiled .mind marker
        if (!markerUrl || !markerUrl.pathname.endsWith(".mind")) {
          setStatus("no-marker");
          return;
        }
        const mediaUrl = safeHttpsUrl(experience.media_url);

        // Load sequentially: A-Frame must fully register custom elements before
        // MindAR's aframe component registers against it.
        for (const src of MINDAR_SCRIPTS) await loadScript(src);
        // Wait until AFRAME + the mindar-image component are actually available.
        await waitFor(
          () =>
            typeof (window as any).AFRAME !== "undefined" &&
            !!(window as any).AFRAME?.components?.["mindar-image"],
        );
        if (!mounted || !sceneRef.current) return;

        // Build scene with DOM APIs so untrusted URLs are always treated as
        // attribute values, never as HTML/script.
        const root = sceneRef.current;
        root.replaceChildren();

        const scenEl = document.createElement("a-scene");
        scenEl.setAttribute(
          "mindar-image",
          `imageTargetSrc: ${markerUrl.href}; autoStart: true; uiScanning: #scanning; uiLoading: #loading; maxTrack: 1; filterMinCF: 0.0001; filterBeta: 0.01; warmupTolerance: 5; missTolerance: 5;`,
        );
        scenEl.setAttribute("color-space", "sRGB");
        scenEl.setAttribute("renderer", "colorManagement: true, physicallyCorrectLights: true, antialias: false, precision: mediump");
        scenEl.setAttribute("vr-mode-ui", "enabled: false");
        scenEl.setAttribute("device-orientation-permission-ui", "enabled: false");
        scenEl.setAttribute("embedded", "");
        scenEl.style.width = "100%";
        scenEl.style.height = "100vh";

        const assets = document.createElement("a-assets");
        let videoEl: HTMLVideoElement | null = null;
        if (mediaUrl) {
          if (experience.media_type === "video") {
            const v = document.createElement("video");
            v.id = "ar-media";
            v.src = mediaUrl.href;
            v.preload = "auto";
            v.loop = experience.loop_playback !== false;
            v.muted = true; // required for mobile autoplay
            v.defaultMuted = true;
            v.autoplay = true;
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
            av.setAttribute("autoplay", String(!!experience.autoplay));
            av.setAttribute("loop", String(!!experience.loop_playback));
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
        scenEl.appendChild(target);

        for (const id of ["loading", "scanning"]) {
          const d = document.createElement("div");
          d.id = id;
          d.style.display = "none";
          scenEl.appendChild(d);
        }

        root.appendChild(scenEl);
        scene = scenEl;

        // Kick playback from the launch gesture so iOS/Android honor autoplay
        // when the marker locks. Muted + playsinline above satisfies the policy.
        if (videoEl) {
          const kick = () => videoEl!.play().catch(() => {});
          kick();
          scenEl.addEventListener("targetFound", kick);
          scenEl.addEventListener("loaded", kick);
        }

        setStatus("ready");
      } catch (e: any) {
        setErrorMsg(e.message ?? "Failed to start AR");
        setStatus("error");
      }
    })();

    return () => {
      mounted = false;
      try {
        scene?.systems?.["mindar-image-system"]?.stop?.();
      } catch {}
      if (sceneRef.current) sceneRef.current.innerHTML = "";
    };
  }, [experience]);

  if (status === "error") {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div className="max-w-sm">
          <p className="text-lg mb-2">AR couldn't start</p>
          <p className="text-sm text-white/60 mb-6">{errorMsg}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-white text-black px-5 py-2 text-sm font-medium"
            >
              Reload &amp; try again
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

  if (status === "no-marker") return <PlainCameraFallback experience={experience} />;

  return (
    <>
      {status === "loading" && (
        <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
          <div className="text-sm text-white/70">Loading AR engine…</div>
        </div>
      )}
      <div ref={sceneRef} className="absolute inset-0" />
    </>
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
