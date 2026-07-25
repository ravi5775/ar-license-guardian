import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useIsDesktopViewport, useReducedMotionPref } from "@/hooks/use-motion-env";
import { workflowMedia } from "@/lib/workflow-media";

/**
 * "How Aether works" as a camera-driven product reveal: three scroll-pinned,
 * scrubbed beats. On mobile / reduced motion the same beats render as plain
 * fade-up cards with no pinning or scrubbing.
 */
export function ProductReveal() {
  const reduced = useReducedMotionPref();
  const isDesktop = useIsDesktopViewport();
  const cinematic = isDesktop && !reduced;

  return (
    <section id="how" className="border-t border-border/40">
      <div className="px-6 pt-28 pb-4 mx-auto max-w-7xl">
        <p className="text-xs uppercase tracking-widest text-primary mb-4">How Aether works</p>
        <h2 className="text-5xl sm:text-6xl lg:text-7xl leading-[0.95] max-w-3xl">
          Three moves between paper and augmented reality.
        </h2>
      </div>

      <Beat
        cinematic={cinematic}
        index={1}
        title="Upload the moment"
        body="Every photograph is paired with the film that belongs to it, then compiled into one marker file for the whole album."
        render={(p) => <BeatOne p={p} />}
      />
      <Beat
        cinematic={cinematic}
        index={2}
        title="Print the trigger"
        body="The print leaves the press clean — the artwork is the trigger. An optional album card carries the link for guests."
        render={(p) => <BeatTwo p={p} />}
      />
      <Beat
        cinematic={cinematic}
        index={3}
        title="Guest scans, AR plays"
        body="A phone camera finds the print, the scan line sweeps, and the memory plays back locked to the paper."
        render={(p) => <BeatThree p={p} />}
      />
    </section>
  );
}

type Progress = { current: number };

function Beat({
  cinematic,
  index,
  title,
  body,
  render,
}: {
  cinematic: boolean;
  index: number;
  title: string;
  body: string;
  render: (p: React.RefObject<Progress>) => React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const progress = useRef<Progress>({ current: 0 });

  useEffect(() => {
    if (!cinematic || !wrapRef.current) return;
    const ScrollTrigger = registerScrollTrigger();

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrapRef.current!,
        start: "top top",
        end: "+=150%",
        pin: true,
        scrub: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          progress.current.current = self.progress;
          const stage = stageRef.current;
          if (!stage) return;
          const p = self.progress;
          stage.style.setProperty("--p", String(p));
          // clip-path reveal: horizontal bar → full frame
          const inset = Math.max(0, 40 - p * 90);
          stage.style.clipPath = `inset(${inset}% 0% ${inset}% 0%)`;
          stage.style.transform = `perspective(1400px) translateZ(${-160 + p * 160}px) scale(${0.92 + p * 0.08})`;
        },
      });

      gsap.fromTo(
        copyRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: { trigger: wrapRef.current!, start: "top top", end: "+=60%", scrub: true },
        },
      );
    }, wrapRef);

    return () => ctx.revert();
  }, [cinematic]);

  if (!cinematic) {
    return (
      <div className="px-6 py-16 mx-auto max-w-3xl animate-fade-in">
        <p className="font-mono text-xs text-primary">0{index}</p>
        <h3 className="text-3xl mt-2">{title}</h3>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{body}</p>
        <div className="mt-6 rounded-2xl overflow-hidden border border-border bg-surface">
          <div className="relative aspect-[4/3]">{render(progress)}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-screen overflow-hidden">
      <div className="mx-auto max-w-7xl h-full px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div ref={copyRef}>
          <p className="font-mono text-sm text-primary">0{index}</p>
          <h3 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.02] mt-4">{title}</h3>
          <p className="mt-8 text-lg text-muted-foreground max-w-md leading-relaxed">{body}</p>
        </div>
        <div
          ref={stageRef}
          className="relative h-[62vh] rounded-3xl overflow-hidden border border-border bg-surface will-change-transform"
          style={{ clipPath: "inset(40% 0% 40% 0%)" }}
        >
          {render(progress)}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Beat visuals --------------------------- */

/** Photo materializes while scattered code fragments assemble into a grid. */
function BeatOne({ p }: { p: React.RefObject<Progress> }) {
  const ref = useRef<HTMLDivElement>(null);
  useRaf(() => {
    const el = ref.current;
    if (!el) return;
    const v = p.current?.current ?? 1;
    el.querySelectorAll<HTMLElement>("[data-frag]").forEach((f, i) => {
      const seed = ((i * 37) % 11) / 10 - 0.5;
      const k = 1 - Math.min(1, v * 1.4);
      f.style.transform = `translate(${seed * 220 * k}px, ${((i % 5) - 2) * 60 * k}px) rotate(${seed * 90 * k}deg)`;
      f.style.opacity = String(0.25 + (1 - k) * 0.75);
    });
  });

  return (
    <div ref={ref} className="absolute inset-0">
      <img src={workflowMedia.weddingPhotoLarge} alt="Uploaded wedding photograph" className="absolute inset-0 w-full h-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-background/50" />
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-1 p-[22%]">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            data-frag
            className="rounded-[2px] bg-primary/80"
            style={{ opacity: (i * 7) % 3 === 0 ? 0.9 : 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Marker card lands onto the printed surface and settles. */
function BeatTwo({ p }: { p: React.RefObject<Progress> }) {
  const ref = useRef<HTMLDivElement>(null);
  useRaf(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-card]");
    if (!el) return;
    const v = p.current?.current ?? 1;
    const drop = Math.max(0, 1 - v * 1.6);
    el.style.transform = `translateY(${-drop * 220}px) rotateX(${drop * 45}deg) scale(${1 + drop * 0.15})`;
    el.style.boxShadow = `0 ${20 + drop * 60}px ${40 + drop * 80}px -20px oklch(0 0 0 / ${0.7})`;
  });

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1000px" }}>
      <img src={workflowMedia.printedInvitation} alt="Printed invitation card" className="absolute inset-0 w-full h-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-background/60" />
      <div data-card className="relative w-[46%] aspect-[3/4] rounded-xl overflow-hidden border border-primary/40 will-change-transform">
        <img src={workflowMedia.weddingPhoto} alt="The photo used as the AR trigger" className="w-full h-full object-cover" />
        <span className="absolute bottom-2 left-2 font-mono text-[10px] text-primary bg-background/70 px-1.5 py-0.5 rounded">
          no QR printed
        </span>
      </div>
    </div>
  );
}

/** Phone frame rises, scan line sweeps, AR video blooms inside. */
function BeatThree({ p }: { p: React.RefObject<Progress> }) {
  const ref = useRef<HTMLDivElement>(null);
  useRaf(() => {
    const root = ref.current;
    if (!root) return;
    const v = p.current?.current ?? 1;
    const phone = root.querySelector<HTMLElement>("[data-phone]");
    const scan = root.querySelector<HTMLElement>("[data-scan]");
    const vid = root.querySelector<HTMLElement>("[data-vid]");
    if (phone) {
      const rise = Math.max(0, 1 - v * 2.2);
      phone.style.transform = `translateY(${rise * 200}px) scale(${1 - rise * 0.08})`;
      phone.style.opacity = String(1 - rise * 0.6);
    }
    if (scan) {
      const s = Math.min(1, Math.max(0, (v - 0.35) / 0.3));
      scan.style.opacity = String(s > 0 && s < 1 ? 1 : 0);
      scan.style.top = `${s * 100}%`;
    }
    if (vid) {
      const s = Math.min(1, Math.max(0, (v - 0.6) / 0.3));
      vid.style.opacity = String(s);
      vid.style.filter = `brightness(${1 + s * 0.25})`;
    }
  });

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center">
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(45% 45% at 50% 55%, oklch(0.83 0.14 78 / 0.28), transparent 70%)" }} />
      <div data-phone className="relative h-[78%] aspect-[9/19] rounded-[2rem] border-4 border-border bg-background overflow-hidden glow-ring will-change-transform">
        <img src={workflowMedia.weddingPhoto} alt="Camera view of a printed photo" className="absolute inset-0 w-full h-full object-cover" />
        <video
          data-vid
          src={workflowMedia.weddingVideo}
          poster={workflowMedia.weddingVideoPoster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-0"
        />
        <span data-scan className="absolute left-0 right-0 h-[2px] bg-primary shadow-[0_0_20px_var(--primary)] opacity-0" />
      </div>
    </div>
  );
}

/** Lightweight rAF loop used to read the pinned scrub progress. */
function useRaf(cb: () => void) {
  useEffect(() => {
    let id = 0;
    const tick = () => {
      cb();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
