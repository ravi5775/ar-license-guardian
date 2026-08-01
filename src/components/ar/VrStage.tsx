import { useEffect, useRef, useState } from "react";
import { Headset, X } from "lucide-react";
import {
  AR_STAGE_CLASS,
  applySceneHygiene,
  detectDeviceTier,
  ensureArStageStyles,
  releaseCameraStreams,
  rendererConfig,
} from "@/lib/ar-runtime";

/**
 * Immersive VR viewer.
 *
 * Deliberately a *separate* scene from the AR stage: MindAR owns the camera
 * feed and drives its own render loop, and A-Frame only supports one active
 * WebXR session per scene. Mounting this component means the AR stage has
 * been unmounted (camera released, MindAR stopped, WebGL context disposed),
 * so there is never a second live context. Leaving VR unmounts this scene and
 * remounts the AR stage from scratch, which re-initialises tracking state
 * cleanly instead of trying to resume a half-torn-down session.
 */
export function VrStage({
  mediaUrl,
  mediaType,
  loop = true,
  onExit,
  ensureEngine,
}: {
  mediaUrl?: string | null;
  mediaType?: string | null;
  loop?: boolean;
  onExit: () => void;
  ensureEngine: () => Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    ensureArStageStyles();
    const tier = detectDeviceTier();

    void (async () => {
      try {
        await ensureEngine();
        if (disposed || !rootRef.current) return;
        const root = rootRef.current;
        root.replaceChildren();

        const scene = document.createElement("a-scene");
        applySceneHygiene(scene);
        // VR needs the entry UI + keyboard shortcut back on this scene only.
        scene.setAttribute("vr-mode-ui", "enabled: true");
        scene.setAttribute("renderer", rendererConfig(tier));
        scene.setAttribute("background", "color: #050505");

        const assets = document.createElement("a-assets");
        if (mediaUrl && mediaType === "video") {
          const v = document.createElement("video");
          v.id = "vr-media";
          v.src = mediaUrl;
          v.loop = loop;
          v.muted = true;
          v.defaultMuted = true;
          v.playsInline = true;
          v.crossOrigin = "anonymous";
          v.preload = "auto";
          v.setAttribute("muted", "");
          v.setAttribute("playsinline", "");
          v.setAttribute("webkit-playsinline", "");
          assets.appendChild(v);
        } else if (mediaUrl && mediaType === "image") {
          const img = document.createElement("img");
          img.id = "vr-media";
          img.src = mediaUrl;
          img.crossOrigin = "anonymous";
          assets.appendChild(img);
        }
        scene.appendChild(assets);

        const cam = document.createElement("a-camera");
        cam.setAttribute("position", "0 1.6 0");
        cam.setAttribute("wasd-controls", "enabled: false");
        scene.appendChild(cam);

        // Floating cinema screen 2.6m in front of the viewer.
        if (mediaUrl) {
          const screen = document.createElement(
            mediaType === "image" ? "a-image" : "a-video",
          );
          screen.setAttribute("src", "#vr-media");
          screen.setAttribute("width", "3.2");
          screen.setAttribute("height", mediaType === "image" ? "3.2" : "1.8");
          screen.setAttribute("position", "0 1.7 -2.6");
          scene.appendChild(screen);
        }

        const floor = document.createElement("a-circle");
        floor.setAttribute("rotation", "-90 0 0");
        floor.setAttribute("radius", "6");
        floor.setAttribute("color", "#0d0d10");
        floor.setAttribute("shader", "flat");
        scene.appendChild(floor);

        root.appendChild(scene);
        sceneRef.current = scene;

        scene.addEventListener("exit-vr", () => {
          if (!disposed) onExit();
        });
        scene.addEventListener(
          "renderstart",
          () => {
            const v = document.getElementById("vr-media");
            if (v instanceof HTMLVideoElement) void v.play().catch(() => {});
          },
          { once: true },
        );
      } catch (e: any) {
        if (!disposed) setError(e?.message ?? "VR mode failed to start");
      }
    })();

    return () => {
      disposed = true;
      try {
        sceneRef.current?.exitVR?.();
        sceneRef.current?.renderer?.dispose?.();
      } catch {
        /* already gone */
      }
      if (rootRef.current) {
        releaseCameraStreams(rootRef.current);
        rootRef.current.replaceChildren();
      }
      sceneRef.current = null;
    };
  }, [mediaUrl, mediaType, loop, onExit, ensureEngine]);

  return (
    <>
      <div ref={rootRef} className={AR_STAGE_CLASS} />
      <button
        onClick={onExit}
        className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-2 text-xs text-white hover:bg-white/20"
      >
        <X className="h-3.5 w-3.5" /> Exit VR
      </button>
      {error && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 text-center text-white">
          <div>
            <Headset className="mx-auto mb-3 h-6 w-6 opacity-60" />
            <p className="text-sm text-white/70">{error}</p>
            <button
              onClick={onExit}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm text-black"
            >
              Back to AR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
