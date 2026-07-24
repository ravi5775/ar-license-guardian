import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, ScanLine, Sparkles } from "lucide-react";

export interface UseCaseContent {
  eyebrow: string;
  h1: string;
  intro: string;
  steps: { title: string; body: string }[];
  bullets: string[];
  faqs: { q: string; a: string }[];
}

export function UseCasePage({ content }: { content: UseCaseContent }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-display text-lg tracking-tight">
              Aether<span className="text-primary">.</span>
            </span>
          </Link>
          <Link
            to="/scan"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ScanLine className="w-3.5 h-3.5" /> Scan QR
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">{content.eyebrow}</p>
        <h1 className="mt-4 text-4xl sm:text-5xl leading-tight font-display">{content.h1}</h1>
        <p className="mt-6 text-muted-foreground leading-relaxed">{content.intro}</p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="mailto:hello@aether.ar?subject=Aether%20AR%20enquiry"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-sm font-medium hover:opacity-90"
          >
            Request a demo <ArrowUpRight className="w-4 h-4" />
          </a>
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm hover:bg-accent"
          >
            See live examples
          </Link>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-display">How it works</h2>
          <ol className="mt-6 space-y-5">
            {content.steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="font-mono text-xs text-primary mt-1">0{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-display">What you get</h2>
          <ul className="mt-6 space-y-3">
            {content.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </span>
                <span className="text-sm text-foreground/90">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-display">Frequently asked questions</h2>
          <dl className="mt-6 space-y-6">
            {content.faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold">{f.q}</dt>
                <dd className="text-sm text-muted-foreground mt-1">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16 border-t border-border/40 pt-10">
          <h2 className="text-2xl font-display">Other AR use cases</h2>
          <nav className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/wedding-ar-albums" className="underline underline-offset-4 hover:text-primary">
              Wedding AR albums
            </Link>
            <Link to="/augmented-reality-photo-album" className="underline underline-offset-4 hover:text-primary">
              Augmented reality photo albums
            </Link>
            <Link to="/ar-greeting-cards" className="underline underline-offset-4 hover:text-primary">
              AR greeting cards
            </Link>
            <Link to="/ar-business-cards" className="underline underline-offset-4 hover:text-primary">
              AR business cards
            </Link>
            <Link to="/ar-wedding-invitations" className="underline underline-offset-4 hover:text-primary">
              AR wedding invitations
            </Link>
          </nav>
        </section>
      </main>

      <footer className="px-6 py-10 border-t border-border/40">
        <p className="mx-auto max-w-3xl text-xs text-muted-foreground font-mono">
          © {new Date().getFullYear()} Aether AR · Print a QR, scan it, watch the memory play.
        </p>
      </footer>
    </div>
  );
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
