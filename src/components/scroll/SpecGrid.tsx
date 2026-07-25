import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

const specs = [
  { value: "20", label: "photos per album", sub: "single compiled .mind marker" },
  { value: "0", label: "app installs", sub: "runs in Safari & Chrome" },
  { value: "₹30,000", label: "one-time", sub: "no revenue share, ever" },
  { value: "9–10", label: "week delivery", sub: "contract to handover" },
];

/** Staggered stat grid, fade/slide up on enter. */
export function SpecGrid() {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reduced || !ref.current) return;
    registerScrollTrigger();
    const ctx = gsap.context(() => {
      gsap.from("[data-spec]", {
        opacity: 0,
        y: 28,
        duration: 0.7,
        stagger: 0.1,
        ease: "expo.out",
        scrollTrigger: { trigger: ref.current!, start: "top 80%", once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={ref} className="px-6 py-24 border-t border-border/40">
      <div className="mx-auto max-w-7xl grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 rounded-2xl overflow-hidden">
        {specs.map((s) => (
          <div key={s.label} data-spec className="bg-surface p-8">
            <p className="font-display text-4xl sm:text-5xl text-primary">{s.value}</p>
            <p className="mt-2 text-sm text-foreground">{s.label}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
