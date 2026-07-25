import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, LayoutDashboard, LogIn, ScanLine, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Item = { label: string; href?: string; to?: string; icon?: typeof ScanLine };

const items: Item[] = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Scan a photo", to: "/scan", icon: ScanLine },
];

/**
 * 3D adaptive pill navigation: a glass pill whose highlight slides to the
 * hovered/active item, with a subtle tilt that tracks the pointer.
 */
export function PillNav() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session && window.location.hash.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname);
        navigate({ to: "/dashboard" });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || active === null) return setThumb(null);
    const el = list.children[active] as HTMLElement | undefined;
    if (!el) return;
    setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  function onMove(e: React.MouseEvent) {
    const el = pillRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
    el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }
  function onLeave() {
    if (pillRef.current) pillRef.current.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg)";
    setActive(null);
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {/* corner brackets */}
      <span aria-hidden className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-primary/40" />
      <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-primary/40" />

      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-tight">
            Aether<span className="text-primary">.</span>
          </span>
        </Link>

        <div
          ref={pillRef}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ transition: "transform 300ms ease" }}
          className="hidden md:block rounded-full border border-border/70 bg-background/60 backdrop-blur-xl px-1.5 py-1.5 shadow-[0_10px_40px_-20px_oklch(0_0_0/0.9)]"
        >
          <div ref={listRef} className="relative flex items-center">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 rounded-full bg-primary/12 border border-primary/30 transition-all duration-300",
                thumb ? "opacity-100" : "opacity-0",
              )}
              style={{ left: thumb?.x ?? 0, width: thumb?.w ?? 0 }}
            />
            {items.map((it, i) => {
              const Icon = it.icon;
              const cls =
                "relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors";
              return it.to ? (
                <Link key={it.label} to={it.to} className={cls} onMouseEnter={() => setActive(i)}>
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {it.label}
                </Link>
              ) : (
                <a key={it.label} href={it.href} className={cls} onMouseEnter={() => setActive(i)}>
                  {it.label}
                </a>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {signedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </Link>
              <a
                href="#pricing"
                className="glow-ring inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Get a quote
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
