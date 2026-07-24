import { useEffect, useState } from "react";

/** True once the component has hydrated on the client. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/** Reads the OS-level prefers-reduced-motion setting (false during SSR). */
export function useReducedMotionPref() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** True when the viewport is wide enough to justify loading WebGL. */
export function useIsDesktopViewport(min = 768) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${min}px)`);
    const onChange = () => setOk(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [min]);
  return ok;
}
