import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { ArrowLeft, Camera, ExternalLink, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan QR — Aether AR" },
      { name: "description", content: "Point your camera at an Aether AR QR code to launch the experience." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setError("Camera requires HTTPS. Open this page over https:// and try again.");
      return;
    }

    const reader = new BrowserQRCodeReader();
    let cancelled = false;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, _err, ctl) => {
            if (!result) return;
            const text = result.getText();
            handleDecoded(text, ctl);
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message ?? "Camera unavailable. Grant camera permission and reload.");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDecoded(text: string, ctl: IScannerControls) {
    let url: URL | null = null;
    try {
      url = new URL(text);
    } catch {
      // Non-URL payload; show raw text as confirm
      ctl.stop();
      setPending(text);
      return;
    }

    // Same-origin AR link — navigate instantly
    if (url.origin === window.location.origin && url.pathname.startsWith("/ar/")) {
      ctl.stop();
      const slug = url.pathname.replace(/^\/ar\//, "").split("/")[0];
      navigate({ to: "/ar/$slug", params: { slug } });
      return;
    }

    // Anything else — confirm before opening
    ctl.stop();
    setPending(url.toString());
  }

  function reset() {
    setPending(null);
    // Re-mount effect by hard reload of the reader
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <Link
        to="/"
        className="absolute top-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs hover:bg-white/20"
      >
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      {error ? (
        <div className="min-h-screen grid place-items-center p-8 text-center">
          <div className="max-w-sm">
            <Camera className="h-10 w-10 mx-auto mb-4 opacity-70" />
            <p className="text-lg mb-2">Can't open camera</p>
            <p className="text-sm text-white/60 mb-6">{error}</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm"
            >
              Back home
            </Link>
          </div>
        </div>
      ) : pending ? (
        <div className="min-h-screen grid place-items-center p-8 text-center">
          <div className="max-w-md w-full">
            <p className="text-xs uppercase tracking-wider text-white/50 mb-2">
              QR detected
            </p>
            <p className="text-sm break-all bg-white/5 rounded-lg p-4 mb-6">
              {pending}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Scan again
              </button>
              {pending.startsWith("http") && (
                <a
                  href={pending}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open link
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Scan viewfinder */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
              <div className="absolute inset-0 border-t-2 border-primary rounded-2xl animate-pulse" />
            </div>
          </div>
          <div className="absolute bottom-8 inset-x-0 text-center">
            <p className="text-sm text-white/80">Point at an Aether QR code</p>
            <p className="text-xs text-white/50 mt-1">Scanning automatically…</p>
          </div>
        </>
      )}
    </div>
  );
}
