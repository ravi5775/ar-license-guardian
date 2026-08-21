import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

/**
 * Full-bleed photo section with two-layer parallax: background image scrubs
 * yPercent -4 → 4 while the foreground caption plate scrubs the other way.
 */
export function ParallaxDepthSection({
  image,
  alt,
  kicker,
  title,
  body,
}: {
  image: string;
  alt: string;
  kicker: string;
  title: string;
  body: string;
}) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !ref.current) return;
    registerScrollTrigger();
    const ctx = gsap.context(() => {
      const st = { trigger: ref.current!, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo(
        bgRef.current,
        { yPercent: -4 },
        { yPercent: 4, ease: "none", scrollTrigger: st },
      );
      gsap.fromTo(
        plateRef.current,
        { yPercent: 6 },
        { yPercent: -6, ease: "none", scrollTrigger: st },
      );
    }, ref);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={ref} className="relative h-[80vh] overflow-hidden border-t border-border/40">
      <img
        ref={bgRef}
        src={image}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 w-full h-[115%] -top-[7%] object-cover object-[50%_35%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20"
      />
      <div className="relative h-full flex items-end">
        <div ref={plateRef} className="mx-auto max-w-7xl w-full px-6 pb-20">
          <div className="max-w-lg rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl p-8">
            <p className="text-xs uppercase tracking-widest text-primary mb-3">{kicker}</p>
            <h3 className="text-3xl sm:text-4xl leading-tight">{title}</h3>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
