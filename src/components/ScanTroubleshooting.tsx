import { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  Lightbulb,
  Crop,
  Move,
  Sun,
  Ruler,
  Sparkles,
  X,
} from "lucide-react";

type Problem = {
  icon: typeof Sun;
  symptom: string;
  cause: string;
  fixes: string[];
};

const problems: Problem[] = [
  {
    icon: Sun,
    symptom: "Nothing happens — the photo is never recognised",
    cause: "Too little light, so the camera can't resolve the fine detail the marker relies on.",
    fixes: [
      "Aim for soft, even room light — a window during the day, or a ceiling light at night.",
      "Never scan in a dark room lit only by your phone screen.",
      "Don't stand between the light source and the photo; your shadow kills detection.",
    ],
  },
  {
    icon: Sparkles,
    symptom: "It detects for a second, then loses the photo",
    cause: "Glare or reflection on a glossy print or glass frame wipes out feature points.",
    fixes: [
      "Tilt the print (or yourself) 10–20° until the bright hotspot slides off the picture.",
      "Take the photo out of a glass frame if you can, or turn off the lamp facing it.",
      "Matte prints track far better than gloss — mention this to your studio.",
    ],
  },
  {
    icon: Crop,
    symptom: "Faces are cut off / only part of the photo is in view",
    cause: "The whole printed picture must be inside the camera frame, edge to edge.",
    fixes: [
      "Step back until all four corners of the print are visible with a small margin.",
      "Hold the phone in the same orientation as the print — portrait for portrait.",
      "Don't cover any part of the photo with your fingers or the album spine.",
    ],
  },
  {
    icon: Ruler,
    symptom: "Only works when very close, or not at all on small prints",
    cause: "Distance vs. print size. A 4×6 needs to be closer than an A4 enlargement.",
    fixes: [
      "Rule of thumb: hold the phone about 1.5× the print's width away from it.",
      "For wallet-size prints get within 15–20 cm.",
      "Clean the rear camera lens — a smudge halves effective detection range.",
    ],
  },
  {
    icon: Move,
    symptom: "Video jitters or drifts off the photo while playing",
    cause: "Camera motion faster than the tracker can follow, or a bending page.",
    fixes: [
      "Move slowly and keep the print flat — press curled album pages down.",
      "Rest your elbows or lean the phone against something for a steady hold.",
      "Stay within roughly 45° of straight-on; extreme angles lose the target.",
    ],
  },
  {
    icon: AlertCircle,
    symptom: "Camera never opens or the screen stays black",
    cause: "Browser permission, another app holding the camera, or an insecure page.",
    fixes: [
      "Allow camera access when prompted, then reload the page.",
      "Close other apps or tabs using the camera (video calls, other scanners).",
      "Use Safari on iPhone or Chrome on Android over https — in-app browsers can block the camera.",
    ],
  },
];

/**
 * Actionable, self-serve help for guests whose scan isn't working —
 * grouped by the symptom they actually see, with lighting and framing fixes.
 */
export function ScanTroubleshooting({ variant = "panel" }: { variant?: "panel" | "overlay" }) {
  const [open, setOpen] = useState(variant === "panel");
  const [expanded, setExpanded] = useState<number | null>(0);

  if (variant === "overlay" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/20"
      >
        <Lightbulb className="h-3.5 w-3.5" /> Scan not working?
      </button>
    );
  }

  const list = (
    <ul className="space-y-2">
      {problems.map((p, i) => {
        const Icon = p.icon;
        const isOpen = expanded === i;
        return (
          <li key={p.symptom} className="rounded-xl border border-white/15 bg-white/5">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              <span className="text-sm">{p.symptom}</span>
              <ChevronDown
                className={`ml-auto h-4 w-4 shrink-0 opacity-60 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pl-11">
                <p className="text-xs text-white/50 mb-2">{p.cause}</p>
                <ul className="space-y-1.5">
                  {p.fixes.map((f) => (
                    <li key={f} className="text-xs text-white/75 flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/50" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur overflow-y-auto p-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg">Scan troubleshooting</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close troubleshooting"
              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {list}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm uppercase tracking-wider text-white/50 mb-3">Scan troubleshooting</h2>
      {list}
    </section>
  );
}
