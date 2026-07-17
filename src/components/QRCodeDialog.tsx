import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, X, Printer } from "lucide-react";

interface Props {
  slug: string;
  title: string;
  onClose: () => void;
}

export function QRCodeDialog({ slug, title, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/ar/${slug}` : `/ar/${slug}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "H" }).then(setDataUrl);
  }, [url]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slug}-qr.png`;
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
      </style></head>
      <body>
        <h1>${title}</h1>
        <p>Scan to view in AR</p>
        <img src="${dataUrl}" alt="QR code"/>
        <p><code>${url}</code></p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif italic">QR code</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid place-items-center py-4">
          {dataUrl ? (
            <img src={dataUrl} alt="QR" className="w-64 h-64 bg-white rounded-md" />
          ) : (
            <div className="w-64 h-64 bg-muted rounded-md animate-pulse" />
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground break-all mb-4">{url}</p>
        <div className="flex gap-2">
          <button
            onClick={download}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" /> PNG
          </button>
          <button
            onClick={print}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" /> Print sheet
          </button>
        </div>
      </div>
    </div>
  );
}
