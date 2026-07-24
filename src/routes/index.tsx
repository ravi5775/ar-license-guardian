import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HeroVisual } from "@/components/hero/HeroVisual";
import { WorkflowDemo } from "@/components/WorkflowDemo";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useReducedMotionPref } from "@/hooks/use-motion-env";

import {
  QrCode,
  ScanLine,
  Sparkles,
  Shield,
  Server,
  Wand2,
  ArrowUpRight,
  Check,
  Camera,
  Cpu,
  LayoutDashboard,
  LogIn,
} from "lucide-react";

const HOME_TITLE = "Aether AR — Wedding AR Albums & Augmented Reality Photo Platform";
const HOME_DESC =
  "Aether AR turns printed photos into video. Wedding AR albums, AR greeting cards, AR business cards and AR invitations — one QR per album, no app install, one-time white-label licence.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { name: "keywords", content: "wedding ar album, augmented reality photo album, ar photo app, ar greeting card, ar business card, ar wedding invitation, ar photo platform" },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://aetherphoto.shop/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [{ rel: "canonical", href: "https://aetherphoto.shop/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Aether AR",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Web",
          description: HOME_DESC,
          url: "https://aetherphoto.shop/",
        }),
      },
    ],
  }),
  component: LandingPage,
});




function LandingPage() {
  const reduced = useReducedMotionPref();
  useSmoothScroll(!reduced);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <LogoStrip />
      <WorkflowDemo />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}


/* ------------------------------- Nav ------------------------------- */

function Nav() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Handle OAuth callback tokens left in the URL hash after redirect.
    // supabase-js will auto-detect and set the session; then route to /dashboard.
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session && window.location.hash.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname);
        navigate({ to: "/dashboard" });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/40">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-tight">Aether<span className="text-primary">.</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <Link to="/scan" className="hover:text-foreground transition-colors inline-flex items-center gap-1"><ScanLine className="w-3.5 h-3.5" />Scan QR</Link>
        </nav>

        <div className="flex items-center gap-2">
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
                className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
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


/* ------------------------------ Hero ------------------------------- */

function Hero() {
  return (
    <HeroVisual>
      <div className="relative text-left">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          White-label AR platform · v1 shipping Q1
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight"
        >
          Turn any photo <br />
          into a <em className="text-primary not-italic font-display italic">portal</em>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed"
        >
          Scan a printed QR, watch the photo come alive as video, 3D, or AR
          overlay. Sold once. Deployed to your own Cloudflare + Supabase.
          Owned by you, forever.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex flex-wrap items-center gap-3"
        >
          <a
            href="#pricing"
            className="glow-ring inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get a quote
            <ArrowUpRight className="w-4 h-4" />
          </a>
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-6 py-3 text-sm font-medium hover:bg-surface transition-colors"
          >
            <ScanLine className="w-4 h-4" />
            Scan a QR
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            See how it works
          </a>
        </motion.div>
      </div>
    </HeroVisual>
  );
}


/* --------------------------- Logo strip ---------------------------- */

function LogoStrip() {
  const uses = [
    "Wedding studios",
    "Print shops",
    "Museums",
    "Real estate",
    "Event agencies",
    "Photographers",
  ];
  return (
    <section className="px-6 py-8 border-y border-border/40">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground text-center mb-6">
          Built for
        </p>
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-4">
          {uses.map((u) => (
            <span key={u} className="text-sm text-muted-foreground/80 font-mono">
              {u}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- How it works -------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Wand2,
      title: "Upload the moment",
      body: "Your client drops in a photo, video, or 3D asset. The admin generates a printable QR bound to that scene.",
    },
    {
      n: "02",
      icon: QrCode,
      title: "Print the trigger",
      body: "The QR goes on the wedding invite, the museum plaque, the album page — anywhere physical.",
    },
    {
      n: "03",
      icon: Camera,
      title: "Guest scans, AR plays",
      body: "Phone camera opens the scene in the browser. No app install. Works on iOS Safari and Android Chrome.",
    },
  ];

  return (
    <section id="how" className="px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl mb-20">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">
            How it works
          </p>
          <h2 className="text-4xl sm:text-5xl leading-tight">
            Three steps between paper and augmented reality.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative rounded-2xl border border-border bg-surface p-8 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.n}
                  </span>
                </div>
                <h3 className="text-2xl mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- Features ----------------------------- */

function Features() {
  const items = [
    {
      icon: Server,
      title: "Your infrastructure",
      body: "Deployed to your Cloudflare Pages, your Supabase, your R2. We hand over the keys. No vendor lock-in, no monthly platform fee to us.",
    },
    {
      icon: Shield,
      title: "License-locked",
      body: "Each deploy is fingerprint-bound to prevent casual duplication. Legal contract is the enforcement layer; the code is the tripwire.",
    },
    {
      icon: Cpu,
      title: "No app install",
      body: "WebAR via MindAR + AR.js. Runs in a mobile browser tab. Zero friction between scan and playback.",
    },
    {
      icon: Sparkles,
      title: "White-label ready",
      body: "Your brand, your domain, your admin login. Ships with a customizable design system and a full RUNBOOK.",
    },
  ];

  return (
    <section id="features" className="px-6 py-32 border-t border-border/40">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl mb-20">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">
            What you get
          </p>
          <h2 className="text-4xl sm:text-5xl leading-tight">
            A platform you own — not a subscription you rent.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {items.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-border bg-surface p-8"
              >
                <Icon className="w-6 h-6 text-primary mb-6" />
                <h3 className="text-2xl mb-3">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- Pricing ----------------------------- */

function Pricing() {
  const included = [
    "Full source code, transferred to your GitHub org",
    "Deployed to your Cloudflare + Supabase Pro (~$25/mo, your account)",
    "Admin dashboard with mandatory TOTP",
    "License agreement + DPA + RUNBOOK",
    "30-day post-handover bug-fix window",
    "MindAR + AR.js WebAR runtime (no per-scan fees)",
  ];

  return (
    <section id="pricing" className="px-6 py-32 border-t border-border/40">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-primary mb-4">
            Pricing
          </p>
          <h2 className="text-4xl sm:text-5xl leading-tight">
            One-time purchase.<br />
            <span className="text-muted-foreground">No revenue share. Ever.</span>
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glow-ring rounded-3xl border border-border bg-surface-elevated p-10 sm:p-14"
        >
          <div className="flex flex-wrap items-baseline gap-3 mb-2">
            <span className="font-display text-6xl">$2,500</span>
            <span className="text-muted-foreground text-lg">– $5,000</span>
          </div>
          <p className="text-sm text-muted-foreground mb-10">
            One-time · scoped per client · optional $99–299/mo maintenance retainer
          </p>

          <ul className="space-y-4 mb-10">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" />
                </span>
                <span className="text-sm text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>

          <a
            href="mailto:hello@aether.ar?subject=Aether%20AR%20quote%20request"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Request a quote
            <ArrowUpRight className="w-4 h-4" />
          </a>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Typical delivery: 9–10 weeks from signed contract to handover.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------- Final CTA ---------------------------- */

function FinalCTA() {
  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-4xl text-center relative">
        <div
          className="absolute inset-0 blur-3xl opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, oklch(0.83 0.14 78 / 0.5), transparent 60%)",
          }}
        />
        <h2 className="relative text-4xl sm:text-6xl leading-tight">
          Ship an AR product<br />without renting one.
        </h2>
        <p className="relative mt-6 text-muted-foreground max-w-xl mx-auto">
          Talk to us about your first deployment. Real reply, usually within a
          business day.
        </p>
        <a
          href="mailto:hello@aether.ar"
          className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          hello@aether.ar
          <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}

/* ----------------------------- Footer ------------------------------ */

function Footer() {
  return (
    <footer className="px-6 py-10 border-t border-border/40">
      <div className="mx-auto max-w-7xl mb-8">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          AR use cases
        </h2>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link to="/wedding-ar-albums" className="hover:text-primary">Wedding AR albums</Link>
          <Link to="/augmented-reality-photo-album" className="hover:text-primary">Augmented reality photo album</Link>
          <Link to="/ar-greeting-cards" className="hover:text-primary">AR greeting cards</Link>
          <Link to="/ar-business-cards" className="hover:text-primary">AR business cards</Link>
          <Link to="/ar-wedding-invitations" className="hover:text-primary">AR wedding invitations</Link>
          <Link to="/gallery" className="hover:text-primary">Gallery</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <span className="font-display text-sm">Aether.</span>
        </div>

        <p className="text-xs text-muted-foreground font-mono">
          © {new Date().getFullYear()} · Built for people who ship.
        </p>
      </div>
    </footer>
  );
}
