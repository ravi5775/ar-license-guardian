import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ScanLine } from "lucide-react";
import { workflowMedia } from "@/lib/workflow-media";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

/** Live gallery experience the demo QR points at. */
const DEMO_PATH = "/ar/bride-groom-hold-hands";

/**
 * "See it before you buy it" — a genuinely scannable QR pointing at a live
 * AR experience, next to a screen-recording of the scan-to-play flow.
 */
export function TryItNow() {
  const [qr, setQr] = useState<string | null>(null);
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const origin =
      import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "https://aetherphoto.shop");
    QRCode.toDataURL(`${origin}${DEMO_PATH}`, {
      width: 640,
      margin: 1,
      color: { dark: "#0b0b0d", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  useEffect(() => {
    if (reduced || !ref.current) return setShown(true);
    const el = ref.current;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShown(true),
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <section
      id="try-it"
      ref={ref}
      className="px-6 py-24 border-t border-border/40"
    >
      <div
        className={`mx-auto max-w-6xl transition-all duration-500 ease-out motion-reduce:transition-none ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">
            Live demo
          </p>
          <h2 className="text-4xl sm:text-5xl leading-tight">
            See it before you buy it.
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 items-stretch max-w-3xl">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center flex flex-col">
            <div className="mx-auto w-full max-w-[220px] aspect-square rounded-xl bg-white p-3">
              {qr ? (
                <img
                  src={qr}
                  alt="QR code linking to a live Aether AR experience"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-black/50">
                  Generating…
                </div>
              )}
            </div>
            <p className="mt-5 text-sm text-foreground/90">
              1. Scan this QR with your phone camera
            </p>
            <a
              href={DEMO_PATH}
              className="mt-auto pt-5 inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary"
            >
              <ScanLine className="h-3.5 w-3.5" /> or open the demo on this device
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
              <img
                src={workflowMedia.demoTrigger}
                alt="Printed wedding photograph — point your phone at this to trigger AR"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-3 rounded-lg border-2 border-dashed border-primary/70 pointer-events-none" />
              <span className="absolute top-3 left-3 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-primary">
                Live trigger
              </span>
            </div>
            <p className="px-5 py-4 text-xs text-muted-foreground">
              2. Point the phone at this photo — no QR printed on it. The picture itself is the marker, and the film plays locked on top of it.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
