import { useEffect, useRef, useState } from "react";
import { BarChart3, LayoutDashboard, Quote, ScanLine } from "lucide-react";
import { workflowMedia } from "@/lib/workflow-media";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

const shots = [
  {
    src: workflowMedia.uploadShot,
    alt: "The Aether admin dashboard where photos and videos are paired",
    caption: "Admin dashboard — pair each photo with its video",
  },
  {
    src: workflowMedia.phoneScanShot,
    alt: "A phone held up to a printed photograph playing AR video",
    caption: "AR viewer — the film plays on the print",
  },
  {
    src: workflowMedia.printedInvitation,
    alt: "A printed invitation card with no QR code on it",
    caption: "Clean prints — no QR code on the photo",
  },
];

const stats = [
  { icon: LayoutDashboard, label: "Deployments", value: "Growing — ask for current numbers" },
  { icon: ScanLine, label: "Scans played", value: "Growing — ask for current numbers" },
  { icon: BarChart3, label: "Per-photo analytics", value: "Built in from day one" },
];

/** Honest trust signals: real product screenshots, no fabricated metrics. */
export function TrustSignals() {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced || !ref.current) return setShown(true);
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShown(true),
      { rootMargin: "-80px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <section ref={ref} className="px-6 py-24 border-t border-border/40">
      <div
        className={`mx-auto max-w-6xl transition-all duration-500 ease-out motion-reduce:transition-none ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">
            Proof
          </p>
          <h2 className="text-4xl sm:text-5xl leading-tight">
            The real product, not a mockup.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="relative aspect-[16/10] w-full bg-muted">
              {shots.map((s, i) => (
                <img
                  key={s.src}
                  src={s.src}
                  alt={s.alt}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
                    i === active ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4">
              {shots.map((s, i) => (
                <button
                  key={s.caption}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    i === active
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.caption}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 content-start">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border bg-surface p-6"
                >
                  <Icon className="mb-3 h-5 w-5 text-primary" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-1 text-sm text-foreground/90">{s.value}</p>
                </div>
              );
            })}
            <div className="rounded-2xl border border-dashed border-border p-6">
              <Quote className="mb-3 h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Client case studies land here as deployments go live. We publish
                names and numbers only with written permission — never invented
                ones.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
