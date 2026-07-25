import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  Images,
  QrCode,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { listPublicAlbums } from "@/lib/albums.functions";
import { ScanTroubleshooting } from "@/components/ScanTroubleshooting";


export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan a photo — Aether AR" },
      {
        name: "description",
        content:
          "Open Aether, point your camera at a printed photo and the matching video plays. No QR printed on the photo, no app install.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const [mode, setMode] = useState<"photo" | "qr">("photo");

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <Link
        to="/"
        className="absolute top-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs hover:bg-white/20"
      >
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      <div className="absolute top-4 right-4 z-30 flex rounded-full bg-white/10 backdrop-blur p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("photo")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            mode === "photo" ? "bg-white text-black" : "hover:bg-white/10"
          }`}
        >
          <ScanLine className="h-3 w-3" /> Photo
        </button>
        <button
          type="button"
          onClick={() => setMode("qr")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            mode === "qr" ? "bg-white text-black" : "hover:bg-white/10"
          }`}
        >
          <QrCode className="h-3 w-3" /> QR link
        </button>
      </div>

      {mode === "photo" ? <PhotoScan /> : <QrScan />}

      {mode === "qr" && <ScanTroubleshooting variant="overlay" />}
    </div>
  );
}



/**
 * QR-free entry: pick the album (auto-selected when there is only one),
 * then hand off to the multi-target .mind viewer which recognises the
 * printed photograph itself.
 */
function PhotoScan() {
  const fetchAlbums = useServerFn(listPublicAlbums);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-albums"],
    queryFn: () => fetchAlbums(),
  });

  const albums = data ?? [];

  useEffect(() => {
    if (albums.length === 1) {
      const t = setTimeout(
        () => window.location.assign(`/ar/album/${encodeURIComponent(albums[0].slug)}`),
        600,
      );
      return () => clearTimeout(t);
    }
  }, [albums]);

  return (
    <div className="min-h-screen p-8 pt-20">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mb-4">
            <Images className="h-6 w-6" />
          </div>
          <h1 className="text-2xl mb-2">Scan the photo itself</h1>
          <p className="text-sm text-white/60">
            Choose the album, point your camera at any picture in it, and its
            video plays on the print.
          </p>
        </div>

        <p className="mb-8 flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-xs text-white/85">
          <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold">No QR code is ever printed on your photos.</strong>{" "}
            The picture itself is the marker — prints stay clean, no codes, borders
            or watermarks.
          </span>
        </p>


        {isLoading && (
          <p className="text-center text-sm text-white/50">Loading albums…</p>
        )}
        {error && (
          <p className="text-center text-sm text-white/60">
            Couldn't load albums. Reload and try again.
          </p>
        )}
        {!isLoading && !error && albums.length === 0 && (
          <p className="text-center text-sm text-white/60">
            No published albums yet. Ask your studio for the album link.
          </p>
        )}

        <ul className="space-y-2">
          {albums.map((a) => (
            <li key={a.slug}>
              <a
                href={`/ar/album/${encodeURIComponent(a.slug)}`}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
              >
                <Camera className="h-4 w-4 opacity-70" />
                <span className="text-sm">{a.title}</span>
                <span className="ml-auto font-mono text-xs text-white/50">
                  {a.target_count ?? 0} photos
                </span>
              </a>
            </li>
          ))}
        </ul>

        <ScanTroubleshooting />
      </div>

    </div>
  );
}

/** Optional QR path — used for album share cards, never printed on photos. */
function QrScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setStarting(false);
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
            handleDecoded(result.getText(), ctl);
          },
        );
        if (cancelled) controls.stop();
        else {
          controlsRef.current = controls;
          setStarting(false);
        }
      } catch (e: any) {
        setStarting(false);
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
      ctl.stop();
      setPending(text);
      return;
    }

    const isAetherHost = [
      window.location.hostname,
      "aetherphoto.shop",
      "www.aetherphoto.shop",
      "ar-license-guardian.lovable.app",
    ].includes(url.hostname);
    if (isAetherHost && url.pathname.startsWith("/ar/")) {
      ctl.stop();
      const rest = url.pathname.replace(/^\/ar\//, "");
      // A full navigation releases the scanner camera before MindAR requests it.
      if (rest.startsWith("album/")) {
        window.location.assign(`/ar/${rest}`);
      } else {
        window.location.assign(`/ar/${encodeURIComponent(rest.split("/")[0])}`);
      }
      return;
    }

    ctl.stop();
    setPending(url.toString());
  }

  if (error) {
    return (
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
    );
  }

  if (pending) {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div className="max-w-md w-full">
          <p className="text-xs uppercase tracking-wider text-white/50 mb-2">QR detected</p>
          <p className="text-sm break-all bg-white/5 rounded-lg p-4 mb-6">{pending}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
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
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="relative w-64 h-64">
          <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
          <div className="absolute inset-0 border-t-2 border-primary rounded-2xl animate-pulse" />
        </div>
      </div>
      <div className="absolute bottom-8 inset-x-0 text-center">
        <p className="text-sm text-white/80">Point at an Aether album QR card</p>
        <p className="text-xs text-white/50 mt-1">
          Photos themselves never carry a QR — switch to Photo mode for those.
        </p>
      </div>
    </>
  );
}
