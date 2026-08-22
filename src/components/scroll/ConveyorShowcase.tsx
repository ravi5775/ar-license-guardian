import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useIsDesktopViewport, useReducedMotionPref } from "@/hooks/use-motion-env";
import { workflowMedia } from "@/lib/workflow-media";

const slides = [
  {
    img: workflowMedia.printedInvitation,
    kicker: "01 — Printed",
    title: "The card leaves the press clean",
    body: "No QR, no watermark, no ugly square. The artwork itself is the trigger.",
  },
  {
    img: workflowMedia.weddingPhotoLarge,
    kicker: "02 — Compiled",
    title: "Feature points, not codes",
    body: "Each photo is compiled into a .mind marker — thousands of tracked points per image.",
  },
  {
    img: workflowMedia.phoneScanShot,
    kicker: "03 — Scanned",
    title: "A guest points a phone",
    body: "The browser opens the camera. No app store, no download, no account.",
  },
  {
    img: workflowMedia.albumPhoto,
    kicker: "04 — Playing",
    title: "The moment plays back",
    body: "Video locks to the print in real time and follows it as the paper moves.",
  },
];

/**
 * Pinned horizontal "conveyor": vertical scroll scrubs a translateX on the
 * image track, with a counter-parallax plate behind for depth.
 * Under 768px (or reduced motion) it degrades to a vertical fade-up stack.
 */
export function ConveyorShowcase() {
  const reduced = useReducedMotionPref();
  const isDesktop = useIsDesktopViewport();
  const horizontal = isDesktop && !reduced;

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!horizontal || !sectionRef.current || !trackRef.current) return;
    const ScrollTrigger = registerScrollTrigger();

    const ctx = gsap.context(() => {
      const track = trackRef.current!;
      const distance = () => track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current!,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      // Counter-parallax plate (opposite direction, slower).
      gsap.fromTo(
        plateRef.current,
        { xPercent: -6 },
        {
          xPercent: 6,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current!,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>("[data-conveyor-caption]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              containerAnimation: undefined,
              start: "top bottom",
              once: true,
            },
            duration: 0.5,
          },
        );
      });

      return () => ScrollTrigger.refresh();
    }, sectionRef);

    return () => ctx.revert();
  }, [horizontal]);

  if (!horizontal) {
    return (
      <section className="px-6 py-24 border-t border-border/40">
        <Heading />
        <div className="mx-auto max-w-xl space-y-10 mt-12">
          {slides.map((s) => (
            <figure key={s.kicker} className="animate-fade-in">
              <div className="rounded-2xl overflow-hidden border border-border bg-surface">
                <img
                  src={s.img}
                  alt={s.title}
                  loading="lazy"
                  className="w-full aspect-[4/3] object-cover object-[50%_35%]"
                />
              </div>
              <figcaption className="mt-4">
                <p className="font-mono text-xs text-primary">{s.kicker}</p>
                <h3 className="text-2xl mt-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative h-screen overflow-hidden border-t border-border/40"
    >
      <div
        ref={plateRef}
        aria-hidden
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 40%, oklch(0.83 0.14 78 / 0.18), transparent 70%), radial-gradient(50% 50% at 80% 60%, oklch(0.62 0.18 32 / 0.14), transparent 70%)",
        }}
      />

      <div className="absolute top-0 inset-x-0 pt-16 px-6 z-10 pointer-events-none">
        <Heading />
      </div>

      <div
        ref={trackRef}
        className="absolute top-[60%] -translate-y-1/2 left-0 flex gap-10 pl-[8vw] pr-[8vw] will-change-transform"
      >
        {slides.map((s) => (
          <figure key={s.kicker} className="w-[62vw] max-w-[720px] shrink-0">
            <div className="rounded-3xl overflow-hidden border border-border bg-surface glow-ring">
              <img
                src={s.img}
                alt={s.title}
                loading="lazy"
                className="w-full aspect-[16/10] object-cover object-[50%_35%]"
              />
            </div>
            <figcaption data-conveyor-caption className="mt-6 max-w-lg">
              <p className="font-mono text-xs text-primary">{s.kicker}</p>
              <h3 className="text-3xl mt-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Heading() {
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs uppercase tracking-widest text-primary mb-3">The conveyor</p>
      <h2 className="text-4xl sm:text-5xl leading-tight max-w-2xl">
        Paper goes in. A moving memory comes out.
      </h2>
    </div>
  );
}
