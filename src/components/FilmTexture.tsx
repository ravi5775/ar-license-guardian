/**
 * Page-wide cinematic texture: a low-opacity dot/noise field plus faint
 * scanlines. Both are fixed, pointer-events-none and under 8% opacity so they
 * add grain without touching readability.
 */
export function FilmTexture() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(oklch(0.97 0.008 90) 0.5px, transparent 0.5px)",
          backgroundSize: "3px 3px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, oklch(0 0 0 / 0.7) 0px, oklch(0 0 0 / 0.7) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </>
  );
}
