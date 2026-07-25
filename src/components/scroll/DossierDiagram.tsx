import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { registerScrollTrigger } from "@/hooks/use-smooth-scroll";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

type Note = { x: number; y: number; lx: number; ly: number; label: string; sub: string; anchor: "start" | "end" };

const notes: Note[] = [
  { x: 400, y: 150, lx: 690, ly: 96, label: "WebAR runtime", sub: "No app install — runs in the phone's browser", anchor: "start" },
  { x: 430, y: 300, lx: 700, ly: 300, label: "Fingerprint-bound licence", sub: "Instance hash checked at activation", anchor: "start" },
  { x: 400, y: 430, lx: 690, ly: 490, label: "Your own infrastructure", sub: "Fast, reliable hosting in your own accounts", anchor: "start" },
  { x: 260, y: 150, lx: 30, ly: 96, label: "Compiled .mind marker", sub: "Thousands of feature points per photo", anchor: "end" },
  { x: 240, y: 320, lx: 20, ly: 330, label: "Signed media URLs", sub: "Time-boxed access to every asset", anchor: "end" },
  { x: 270, y: 450, lx: 40, ly: 500, label: "Scan telemetry", sub: "Per-photo detection & completion rates", anchor: "end" },
];

/** Exploded technical diagram: connector lines draw themselves, labels follow. */
export function DossierDiagram() {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reduced || !ref.current) return;
    registerScrollTrigger();

    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray<SVGPathElement>("[data-dossier-line]");
      lines.forEach((l) => {
        const len = l.getTotalLength();
        gsap.set(l, { strokeDasharray: len, strokeDashoffset: len });
      });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: ref.current!, start: "top 70%", end: "bottom 70%", scrub: 0.8 },
      });

      tl.to(lines, { strokeDashoffset: 0, ease: "power2.inOut", stagger: 0.14, duration: 1 }).to(
        gsap.utils.toArray<HTMLElement>("[data-dossier-label]"),
        { opacity: 1, y: 0, ease: "power2.out", stagger: 0.14, duration: 0.6 },
        "-=0.7",
      );
    }, ref);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={ref} id="dossier" className="px-6 py-32 border-t border-border/40">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">The dossier</p>
          <h2 className="text-4xl sm:text-5xl leading-tight">Scan to AR, exploded.</h2>
        </div>

        <div className="relative">
          <svg viewBox="0 0 1000 560" className="w-full h-auto" role="img" aria-label="Diagram of the scan-to-AR pipeline">
            {/* Central phone */}
            <rect x={300} y={130} width={130} height={300} rx={20} fill="var(--surface-elevated)" stroke="var(--primary)" strokeOpacity={0.5} />
            <rect x={312} y={150} width={106} height={260} rx={10} fill="var(--background)" stroke="var(--border)" />
            <rect x={334} y={205} width={62} height={62} rx={8} fill="none" stroke="var(--primary)" strokeOpacity={0.8} strokeWidth={3} />
            <line x1={330} y1={300} x2={400} y2={300} stroke="var(--primary)" strokeOpacity={0.7} strokeWidth={2} />
            <text x={365} y={385} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
              scan
            </text>

            {notes.map((n) => (
              <path
                key={n.label}
                data-dossier-line
                d={`M ${n.x} ${n.y} L ${(n.x + n.lx) / 2} ${n.y} L ${n.lx} ${n.ly}`}
                fill="none"
                stroke="var(--primary)"
                strokeOpacity={0.55}
                strokeWidth={1.5}
              />
            ))}
            {notes.map((n) => (
              <circle key={n.label + "d"} cx={n.x} cy={n.y} r={3.5} fill="var(--primary)" />
            ))}
          </svg>

          {/* Labels positioned over the SVG grid */}
          <div className="absolute inset-0">
            {notes.map((n) => {
              const isEnd = n.anchor === "end";
              const style: React.CSSProperties = isEnd
                ? { right: `${100 - (n.lx / 1000) * 100}%`, top: `${(n.ly / 560) * 100}%`, transform: "translateY(-50%)", opacity: reduced ? 1 : 0 }
                : { left: `${(n.lx / 1000) * 100}%`, top: `${(n.ly / 560) * 100}%`, transform: "translateY(-50%)", opacity: reduced ? 1 : 0 };
              return (
                <div
                  key={n.label}
                  data-dossier-label
                  style={style}
                  className={`absolute w-[min(38vw,240px)] ${isEnd ? "pr-3 text-right" : "pl-3"}`}
                >
                  <p className="text-sm sm:text-base text-foreground">{n.label}</p>
                  <p className="font-mono text-[10px] sm:text-xs text-muted-foreground leading-snug mt-1">{n.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
