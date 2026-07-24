import { Suspense, lazy, useEffect, useRef, useState } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, QrCode, Printer, Camera, PlayCircle, ArrowRight } from "lucide-react";
import { workflowMedia } from "@/lib/workflow-media";
import { useIsDesktopViewport, useReducedMotionPref } from "@/hooks/use-motion-env";

const WorkflowStage3D = lazy(() => import("./workflow/WorkflowStage3D"));

type Stage = {
  key: string;
  label: string;
  icon: typeof Upload;
  title: string;
  body: string;
  hud: string;
};

const stages: Stage[] = [
  {
    key: "upload",
    label: "Upload",
    icon: Upload,
    title: "Drop the photo and its film",
    body: "Studio uploads each printed still plus the video that belongs to it — up to 20 photos per album.",
    hud: "wedding-01.jpg + ceremony.mp4 · queued",
  },
  {
    key: "qr",
    label: "Compile marker",
    icon: QrCode,
    title: "One .mind file for the whole album",
    body: "All photos compile into a single marker file in the browser. The photograph itself becomes the trigger — nothing is printed on it.",
    hud: "album.mind · 20 targets · feature points extracted",
  },
  {
    key: "print",
    label: "Print clean",
    icon: Printer,
    title: "Print the album as-is",
    body: "No QR, no watermark, no border on any picture. Only the optional album card carries a link for guests who prefer scanning it.",
    hud: "no QR on the print",
  },
  {
    key: "scan",
    label: "Point camera",
    icon: Camera,
    title: "Guest opens the site and points",
    body: "Camera opens in the browser, the printed photo is recognised in under a second on iOS Safari and Android Chrome.",
    hud: "target found · 640ms",
  },
  {
    key: "play",
    label: "AR plays",
    icon: PlayCircle,
    title: "The memory plays in place",
    body: "Video locks onto the printed photo with playback controls, fit-to-screen and download.",
    hud: "playing · fit to screen · download",
  },
];

/**
 * Interactive end-to-end demo. On capable devices one printed photograph
 * travels through all five steps inside a live WebGL stage; elsewhere the same
 * story is told with contained stills and a video, no 3D loaded.
 */
export function WorkflowDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const stageRef = useRef(0);

  const reduced = useReducedMotionPref();
  const isDesktop = useIsDesktopViewport();
  const use3D = isDesktop && !reduced && !webglFailed;

  useEffect(() => {
    stageRef.current = active;
  }, [active]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % stages.length), 4600);
    return () => clearTimeout(t);
  }, [active, paused]);

  const stage = stages[active];

  return (
    <section
      id="demo"
      className="px-6 py-32 border-t border-border/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl mb-14">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">Live walkthrough</p>
          <h2 className="text-4xl sm:text-5xl leading-tight">
            Photo in. Portal out. Watch the whole loop.
          </h2>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          {/* Steps */}
          <ol className="space-y-2" style={{ perspective: "900px" }}>
            {stages.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              return (
                <li key={s.key}>
                  <motion.button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={isActive}
                    animate={{
                      rotateY: isActive ? 0 : -8,
                      x: isActive ? 10 : 0,
                      opacity: isActive ? 1 : 0.62,
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                    style={{ transformStyle: "preserve-3d" }}
                    className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 ${
                      isActive
                        ? "border-primary/50 bg-primary/10 shadow-[0_18px_40px_-24px_var(--color-primary)]"
                        : "border-border bg-surface hover:border-primary/30"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isActive
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm">{s.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      0{i + 1}
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ol>

          {/* Stage viewport */}
          <div className="rounded-2xl border border-border bg-surface-elevated overflow-hidden">
            <div className="relative aspect-[16/10] bg-background">
              {use3D ? (
                <Suspense fallback={<FlatStage stageKey={stage.key} />}>
                  <ErrorFence onError={() => setWebglFailed(true)} stageKey={stage.key}>
                    <WorkflowStage3D stage={stageRef} />
                  </ErrorFence>
                </Suspense>
              ) : (
                <FlatStage stageKey={stage.key} />
              )}

              {/* HUD */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/85 border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap"
                >
                  {stage.hud}
                </motion.p>
              </AnimatePresence>

              {/* Permanent reminder: prints never carry a code */}
              <div
                className={`absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs pointer-events-none transition-colors ${
                  stage.key === "qr" || stage.key === "print"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-background/80 text-muted-foreground"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                No QR printed on the photo
              </div>

              {stage.key === "scan" && (
                <div className="absolute inset-10 border-2 border-primary/60 rounded-xl animate-pulse pointer-events-none" />
              )}


              {/* progress rail */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-border/50">
                <motion.div
                  key={active}
                  className="h-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: paused ? "0%" : "100%" }}
                  transition={{ duration: paused ? 0 : 4.6, ease: "linear" }}
                />
              </div>
            </div>

            <div className="p-6 border-t border-border/60 flex flex-wrap items-start gap-4 justify-between">
              <div>
                <h3 className="text-xl mb-1">{stage.title}</h3>
                <p className="text-sm text-muted-foreground max-w-xl">{stage.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setActive((a) => (a + 1) % stages.length)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                Next step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Non-WebGL story: the same photo, always contained (never cropped). */
function FlatStage({ stageKey }: { stageKey: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stageKey === "play") void v.play().catch(() => undefined);
    else v.pause();
  }, [stageKey]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={stageKey}
          initial={{ opacity: 0, rotateY: -12, scale: 0.96 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative max-w-full max-h-full"
        >
          {stageKey === "play" ? (
            <video
              ref={videoRef}
              src={workflowMedia.weddingVideo}
              poster={workflowMedia.weddingVideoPoster}
              muted
              loop
              playsInline
              preload="metadata"
              className="max-h-[46vh] max-h-full w-auto max-w-full object-contain rounded-xl border border-border"
            />
          ) : (
            <img
              src={
                stageKey === "print" ? workflowMedia.printedInvitation : workflowMedia.weddingPhoto
              }
              alt="Printed wedding photograph moving through the Aether workflow"
              loading="lazy"
              className="max-h-[46vh] max-h-full w-auto max-w-full object-contain rounded-xl border border-border"
            />
          )}
          {stageKey === "qr" && (
            <div className="absolute inset-0 grid grid-cols-6 gap-2 p-4 pointer-events-none">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full bg-primary/70 w-1.5 h-1.5 self-center justify-self-center animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Keeps a WebGL/context failure from taking down the section. */
class ErrorFence extends React.Component<
  { children: React.ReactNode; onError: () => void; stageKey: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.failed) return <FlatStage stageKey={this.props.stageKey} />;
    return this.props.children;
  }
}
