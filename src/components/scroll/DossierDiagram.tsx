import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

type Note = { label: string; sub: string };

const notes: Note[] = [
  { label: "WebAR runtime", sub: "No app install — runs in the phone's browser" },
  { label: "Fingerprint-bound licence", sub: "Instance hash checked at activation" },
  { label: "Your own infrastructure", sub: "Fast, reliable hosting in your own accounts" },
  { label: "Compiled .mind marker", sub: "Thousands of feature points per photo" },
  { label: "Signed media URLs", sub: "Time-boxed access to every asset" },
  { label: "Scan telemetry", sub: "Per-photo detection & completion rates" },
];

/** Technical dossier: centered phone with the pipeline spelled out around it. */
export function DossierDiagram() {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reduced || !ref.current) return;
    registerScrollTrigger();

    const ctx = gsap.context(() => {
      gsap.from(gsap.utils.toArray<HTMLElement>("[data-dossier-label]"), {
        opacity: 0,
        y: 24,
        ease: "power2.out",
        stagger: 0.08,
        duration: 0.6,
        scrollTrigger: { trigger: ref.current!, start: "top 75%" },
      });
    }, ref);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={ref} id="dossier" className="px-6 py-28 border-t border-border/40">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">The dossier</p>
          <h2 className="text-4xl sm:text-5xl leading-tight">Scan to AR, exploded.</h2>
        </div>

        <div className="mt-14 flex justify-center">
          <svg
            viewBox="0 0 200 340"
            className="h-auto w-[140px] sm:w-[168px]"
            role="img"
            aria-label="A phone scanning a printed photo"
          >
            <rect x={35} y={10} width={130} height={300} rx={20} fill="var(--surface-elevated)" stroke="var(--primary)" strokeOpacity={0.5} />
            <rect x={47} y={30} width={106} height={260} rx={10} fill="var(--background)" stroke="var(--border)" />
            <rect x={69} y={85} width={62} height={62} rx={8} fill="none" stroke="var(--primary)" strokeOpacity={0.8} strokeWidth={3} />
            <line x1={69} y1={200} x2={131} y2={200} stroke="var(--primary)" strokeOpacity={0.6} strokeWidth={2} />
            <text x={100} y={245} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
              scan
            </text>
          </svg>
        </div>

        <ul className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <li
              key={n.label}
              data-dossier-label
              className="rounded-xl border border-border/60 bg-card/40 p-5 text-center"
            >
              <p className="text-sm sm:text-base text-foreground">{n.label}</p>
              <p className="mt-2 font-mono text-[11px] leading-snug text-muted-foreground">{n.sub}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
