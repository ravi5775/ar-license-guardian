import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { Download, X, Printer, Lock, Globe, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getShareCredentials, setAccessMode, regeneratePin } from "@/lib/access.functions";

interface Props {
  slug: string;
  title: string;
  /** "album" encodes one QR for the whole album (multi-target scanning). */
  kind?: "experience" | "album";
  /** Row id — enables the restricted-access controls (PIN, token, rotation). */
  id?: string;
  /** Called when the slug changes (switching to restricted mints a new one). */
  onSlugChange?: (slug: string) => void;
  onClose: () => void;
}

interface Share {
  slug: string;
  restricted: boolean;
  pin: string | null;
  tok: string | null;
  pinExpiresAt?: string | null;
}

export function QRCodeDialog({
  slug,
  title,
  kind = "experience",
  id,
  onSlugChange,
  onClose,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [share, setShare] = useState<Share>({
    slug,
    restricted: false,
    pin: null,
    tok: null,
    pinExpiresAt: null,
  });
  const [loading, setLoading] = useState(Boolean(id));
  const [working, setWorking] = useState(false);

  const loadShare = useServerFn(getShareCredentials);
  const setMode = useServerFn(setAccessMode);
  const rotate = useServerFn(regeneratePin);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const path = kind === "album" ? `/ar/album/${share.slug}` : `/ar/${share.slug}`;
  // Always percent-encode: the token alphabet is base64url today, but never
  // assume a character subset stays URL-safe unencoded.
  const url = `${getPublicOrigin()}${path}${
    share.tok ? `?tok=${encodeURIComponent(share.tok)}` : ""
  }`;

  // PINs are stored hashed and QR tokens hashed — neither can be read back.
  // This only loads the access mode; issuing/rotating returns them once.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadShare({ data: { kind, id } })
      .then((r: any) => {
        if (!alive) return;
        setShare({
          slug: r.slug,
          restricted: r.restricted,
          pin: r.pin,
          tok: r.tok,
          pinExpiresAt: r.pinExpiresAt ?? null,
        });
      })
      .catch((e: any) => toast.error(e?.message ?? "Couldn't load share settings"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, kind]);

  // Render the QR, overlaying the plaintext PIN on a light plate in the middle.
  useEffect(() => {
    let alive = true;
    (async () => {
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, url, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: "H",
      });
      if (share.pin) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width;
          const plate = w * 0.26;
          const x = (w - plate) / 2;
          const y = (w - plate * 0.56) / 2;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, plate, plate * 0.56);
          ctx.strokeStyle = "#111111";
          ctx.lineWidth = Math.max(2, w * 0.004);
          ctx.strokeRect(x, y, plate, plate * 0.56);
          ctx.fillStyle = "#111111";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `bold ${Math.round(plate * 0.34)}px monospace`;
          ctx.fillText(share.pin, w / 2, y + plate * 0.3);
        }
      }
      if (alive) {
        canvasRef.current = canvas;
        setDataUrl(canvas.toDataURL("image/png"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, share.pin]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${share.slug}-qr.png`;
    a.click();
  }

  function print() {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    w.document.write(`
      <html><head><title>${title} — AR marker</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:40px;}
        h1{font-family:serif;font-style:italic;font-size:32px;margin:0 0 8px;}
        p{color:#666;font-size:14px;margin:4px 0;}
        img{width:400px;height:400px;margin:24px 0;}
        code{background:#f4f4f4;padding:4px 8px;border-radius:4px;font-size:12px;}
        .pin{font-family:monospace;font-size:22px;letter-spacing:4px;color:#111;}
      </style></head>
      <body>
        <h1>${title}</h1>
        <p>${kind === "album" ? "Scan once, then point your camera at any photo in this album" : "Scan to view in AR"}</p>
        <img src="${dataUrl}" alt="QR code"/>
        ${share.pin ? `<p class="pin">PIN ${share.pin}</p><p>Type this PIN if the link is opened without scanning the card.</p>` : ""}
        <p><code>${url}</code></p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  async function switchMode(mode: "public" | "restricted") {
    if (!id) return;
    setWorking(true);
    try {
      const r: any = await setMode({ data: { kind, id, mode } });
      setShare({
        slug: r.slug,
        restricted: r.restricted,
        pin: r.pin,
        tok: r.tok,
        pinExpiresAt: r.pinExpiresAt ?? null,
      });
      onSlugChange?.(r.slug);
      toast.success(
        mode === "restricted"
          ? "Now restricted — a new private link and PIN were issued."
          : "Now public — the PIN was removed.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't change access mode");
    } finally {
      setWorking(false);
    }
  }

  async function rotatePin() {
    if (!id) return;
    if (
      !confirm(
        "Re-issue the PIN and QR token? Every previously printed card stops working immediately.",
      )
    )
      return;
    setWorking(true);
    try {
      const r: any = await rotate({ data: { kind, id } });
      setShare({
        slug: r.slug,
        restricted: true,
        pin: r.pin,
        tok: r.tok,
        pinExpiresAt: r.pinExpiresAt ?? null,
      });
      toast.success("New PIN issued — reprint the QR.");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't regenerate PIN");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif italic">Share &amp; QR code</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid place-items-center py-2">
          {dataUrl ? (
            <img src={dataUrl} alt="QR" className="w-60 h-60 bg-white rounded-md" />
          ) : (
            <div className="w-60 h-60 bg-muted rounded-md animate-pulse" />
          )}
        </div>

        {id && (
          <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading access settings…
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    disabled={working}
                    onClick={() => switchMode("public")}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 ${
                      share.restricted
                        ? "border-border text-muted-foreground hover:bg-accent"
                        : "border-primary/40 bg-primary/10 text-primary"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" /> Public link
                  </button>
                  <button
                    disabled={working}
                    onClick={() => switchMode("restricted")}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 ${
                      share.restricted
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" /> PIN protected
                  </button>
                </div>

                {share.restricted && (
                  <div className="mt-3 flex items-center gap-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Access PIN</p>
                      <p className="font-mono text-lg tracking-[0.3em]">
                        {share.pin ?? "— hidden —"}
                      </p>
                      {!share.pin && (
                        <p className="text-[11px] text-muted-foreground">
                          Stored hashed — re-issue to see and print it again.
                        </p>
                      )}
                      {share.pinExpiresAt && (
                        <p className="text-[11px] text-muted-foreground">
                          Expires {new Date(share.pinExpiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      disabled={working}
                      onClick={rotatePin}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${working ? "animate-spin" : ""}`} />
                      Re-issue PIN + QR
                    </button>
                  </div>
                )}

                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {share.restricted
                    ? "Scanning the printed QR opens instantly — the card itself is the credential. A forwarded link without the code asks for the PIN printed on the card."
                    : "Anyone with this link can open the experience. Switch to PIN protected to issue a private link and printable PIN."}
                </p>
              </>
            )}
          </div>
        )}

        {kind === "album" && (
          <p className="mt-3 text-xs text-center text-muted-foreground">
            One QR code covers the whole album — customers scan once, then point their camera at any
            photo to play its video.
          </p>
        )}
        <p className="mt-2 text-xs text-center text-muted-foreground break-all mb-4">{url}</p>

        <div className="flex gap-2">
          <button
            onClick={download}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Download
          </button>
          <button
            onClick={print}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

function getPublicOrigin() {
  if (typeof window === "undefined") return "https://aetherphoto.shop";
  const { hostname, origin } = window.location;
  if (
    hostname === "localhost" ||
    hostname.includes("lovable.app") ||
    hostname.includes("lovableproject.com")
  ) {
    return "https://aetherphoto.shop";
  }
  return origin;
}
