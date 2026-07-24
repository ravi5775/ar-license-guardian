import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, QrCode, Printer, Camera, PlayCircle, ArrowRight } from "lucide-react";
import { workflowMedia, demoScanUrl } from "@/lib/workflow-media";

type Stage = {
  key: string;
  label: string;
  icon: typeof Upload;
  title: string;
  body: string;
};

const stages: Stage[] = [
  {
    key: "upload",
    label: "Upload",
    icon: Upload,
    title: "Drop the photo and its film",
    body: "Studio uploads each printed still plus the video that belongs to it — up to 20 photos per album.",
  },
  {
    key: "qr",
    label: "Compile marker",
    icon: QrCode,
    title: "One .mind file for the whole album",
    body: "All photos compile into a single marker file in the browser. The photograph itself becomes the trigger — nothing is printed on it.",
  },
  {
    key: "print",
    label: "Print clean",
    icon: Printer,
    title: "Print the album as-is",
    body: "No QR, no watermark, no border on any picture. Only the optional album card carries a link for guests who prefer scanning it.",
  },
  {
    key: "scan",
    label: "Point camera",
    icon: Camera,
    title: "Guest opens the site and points",
    body: "Camera opens in the browser, the printed photo is recognised in under a second on iOS Safari and Android Chrome.",
  },
  {
    key: "play",
    label: "AR plays",
    icon: PlayCircle,
    title: "The memory plays in place",
    body: "Video locks onto the printed photo with playback controls, fit-to-screen and download.",
  },
];


/**
 * Interactive end-to-end demo. Auto-advances, pauses on hover, and every step
 * is directly clickable — showing the real Aether flow with real media.
 */
export function WorkflowDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % stages.length), 4200);
    return () => clearTimeout(t);
  }, [active, paused]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stages[active].key === "play") void v.play().catch(() => undefined);
    else v.pause();
  }, [active]);

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
          <ol className="space-y-2">
            {stages.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={isActive}
                    className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${
                      isActive
                        ? "border-primary/50 bg-primary/10"
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
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Stage viewport */}
          <div className="rounded-2xl border border-border bg-surface-elevated overflow-hidden">
            <div className="relative aspect-[16/10] bg-background">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage.key}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  className="absolute inset-0"
                >
                  <StageVisual stageKey={stage.key} videoRef={videoRef} />
                </motion.div>
              </AnimatePresence>
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

function StageVisual({
  stageKey,
  videoRef,
}: {
  stageKey: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  if (stageKey === "upload") {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-3 p-6">
        <img
          src={workflowMedia.weddingPhoto}
          alt="Wedding photo being uploaded to the Aether admin"
          loading="lazy"
          className="w-full h-full object-cover rounded-xl border border-border"
        />
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-2 text-center px-4">
          <Upload className="w-6 h-6 text-primary" />
          <p className="text-sm">wedding-01.jpg + ceremony.mp4</p>
          <p className="font-mono text-xs text-muted-foreground">marker compiled · 0.8s</p>
        </div>
      </div>
    );
  }

  if (stageKey === "qr") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="w-10 h-10 rounded-md border border-primary/40 bg-primary/10"
              style={{ opacity: 0.35 + (i % 4) * 0.18 }}
            />
          ))}
        </div>
        <div>
          <p className="font-mono text-sm">album.mind · 20 targets</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            feature points extracted — photos stay untouched
          </p>
        </div>
      </div>
    );
  }

  if (stageKey === "print") {
    return (
      <div className="absolute inset-0">
        <img
          src={workflowMedia.printedInvitation}
          alt="Printed wedding album page with no QR code on the photograph"
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <p className="absolute bottom-5 right-5 rounded-full bg-background/85 border border-border px-3 py-1.5 font-mono text-xs">
          no QR on the print
        </p>
      </div>
    );
  }


  if (stageKey === "scan") {
    return (
      <div className="absolute inset-0">
        <img
          src={workflowMedia.weddingPhotoLarge}
          alt="Phone camera identifying the printed photograph"
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/40" />
        <div className="absolute inset-8 border-2 border-primary/70 rounded-xl animate-pulse" />
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-xs bg-background/80 border border-border rounded-full px-3 py-1">
          target found · 640ms
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        src={workflowMedia.weddingVideo}
        poster={workflowMedia.weddingVideoPoster}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-background/85 border border-border px-3 py-1.5 text-xs">
        <PlayCircle className="w-3.5 h-3.5 text-primary" />
        playing · fit to screen · download
      </div>
    </div>
  );
}
