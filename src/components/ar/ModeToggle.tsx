import { Gauge, Headset, Scan } from "lucide-react";
import { getPerfMode, setPerfMode, type PerfMode } from "@/lib/ar-runtime";
import { useState } from "react";

/**
 * Compact AR ⇄ VR switch. Always visible: without a headset the VR scene is a
 * look-around "magic window" cinema, which is still a useful mode — so we do
 * not hide the control behind `navigator.xr` support.
 */
export function ArVrToggle({
  mode,
  onChange,
  headset,
}: {
  mode: "ar" | "vr";
  onChange: (mode: "ar" | "vr") => void;
  headset?: boolean;
}) {
  return (
    <div className="pointer-events-auto inline-flex items-center rounded-full bg-black/45 backdrop-blur p-0.5 text-[11px] text-white ring-1 ring-white/15">
      <button
        type="button"
        aria-pressed={mode === "ar"}
        onClick={() => onChange("ar")}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
          mode === "ar" ? "bg-white text-black" : "text-white/75"
        }`}
      >
        <Scan className="h-3 w-3" /> AR
      </button>
      <button
        type="button"
        aria-pressed={mode === "vr"}
        onClick={() => onChange("vr")}
        title={headset ? "Immersive VR" : "360° cinema view"}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
          mode === "vr" ? "bg-white text-black" : "text-white/75"
        }`}
      >
        <Headset className="h-3 w-3" /> VR
      </button>
    </div>
  );
}

/**
 * "Lite mode" pins the low performance tier (480p camera, 24fps, 1x pixel
 * ratio, extra tracking smoothing) for older phones. Restarts the session so
 * the new caps apply to the live camera track.
 */
export function PerfToggle({ onChanged }: { onChanged: () => void }) {
  const [mode, setMode] = useState<PerfMode>(() => getPerfMode());

  return (
    <button
      type="button"
      onClick={() => {
        const next: PerfMode = mode === "lite" ? "auto" : "lite";
        setPerfMode(next);
        setMode(next);
        onChanged();
      }}
      aria-pressed={mode === "lite"}
      title="Lower resolution and framerate for older phones"
      className={`pointer-events-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] backdrop-blur ring-1 ring-white/15 transition-colors ${
        mode === "lite" ? "bg-amber-400 text-black" : "bg-black/45 text-white/75"
      }`}
    >
      <Gauge className="h-3 w-3" /> Lite
    </button>
  );
}
