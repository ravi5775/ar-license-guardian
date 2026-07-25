import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useIsDesktopViewport, useReducedMotionPref } from "@/hooks/use-motion-env";
import { workflowMedia } from "@/lib/workflow-media";

const PortalScene = lazy(() => import("./PortalScene"));

/**
 * Cinematic hero: on desktop the printed photo opens into a video portal,
 * scrubbed 1:1 with scroll. On mobile / reduced-motion the same story is told
 * with a CSS crossfade from photo to muted video loop — no WebGL is loaded.
 */
export function HeroVisual({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [webglFailed, setWebglFailed] = useState(false);

  const reduced = useReducedMotionPref();
  const isDesktop = useIsDesktopViewport();
  const use3D = isDesktop && !reduced && !webglFailed;

  useEffect(() => {
    if (!use3D || !wrapRef.current) return;
    const ScrollTrigger = registerScrollTrigger();

    const ctx = gsap.context(() => {
      const st = ScrollTrigger.create({
        trigger: wrapRef.current!,
        start: "top top",
        end: "+=220%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          progress.current = self.progress;
        },
      });

      gsap.to(copyRef.current, {
        opacity: 0,
        y: -60,
        ease: "none",
        scrollTrigger: {
          trigger: wrapRef.current!,
          start: "top top",
          end: "+=80%",
          scrub: true,
        },
      });

      gsap.to(canvasWrapRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: wrapRef.current!,
          start: "+=170%",
          end: "+=220%",
          scrub: true,
        },
      });

      return () => st.kill();
    }, wrapRef);

    return () => ctx.revert();
  }, [use3D]);

  return (
    <div ref={wrapRef} className="relative min-h-screen overflow-hidden">
      {/* Ambient warmth */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[90vw] h-[70vh] rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, oklch(0.83 0.14 78 / 0.35), transparent 62%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-16 grid lg:grid-cols-2 gap-10 items-center min-h-screen">
        <div ref={copyRef}>{children}</div>

        <div className="relative h-[52vh] sm:h-[62vh] lg:h-[78vh]">
          {use3D ? (
            <div ref={canvasWrapRef} className="absolute inset-0">
              <Suspense fallback={<StaticPortal />}>
                <ErrorFence onError={() => setWebglFailed(true)}>
                  <PortalScene progress={progress} />
                </ErrorFence>
              </Suspense>
            </div>
          ) : (
            <StaticPortal animated={!reduced} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Mobile / fallback story: photo crossfades into the video loop. */
function StaticPortal({ animated = true }: { animated?: boolean }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!animated) return;
    const t = setTimeout(() => setRevealed(true), 1400);
    return () => clearTimeout(t);
  }, [animated]);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="glow-ring relative w-full max-w-xl aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-surface-elevated">
        <img
          src={workflowMedia.weddingPhotoLarge}
          alt="Printed wedding photograph that opens into an AR video"
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-[50%_35%] transition-opacity duration-1000"
          style={{ opacity: revealed ? 0 : 1 }}
        />
        <video
          src={workflowMedia.weddingVideo}
          poster={workflowMedia.weddingVideoPoster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000"
          style={{ opacity: revealed ? 1 : 0 }}
        />

        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
          <p className="font-mono text-xs text-muted-foreground">photo → portal</p>
        </div>
      </div>
    </div>
  );
}

/** Keeps a WebGL/context failure from taking down the page. */
import React from "react";
class ErrorFence extends React.Component<
  { children: React.ReactNode; onError: () => void },
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
    if (this.state.failed) return <StaticPortal />;
    return this.props.children;
  }
}
