import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, ExternalLink } from "lucide-react";

const listPublicExperiences = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data } = await sb
    .from("ar_experiences")
    .select("slug, title, description, cover_image_url")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(60);
  return data ?? [];
});

export const Route = createFileRoute("/gallery")({
  loader: () => listPublicExperiences(),
  head: () => ({
    meta: [
      { title: "AR Gallery — Live Augmented Reality Photo Experiences | Aether AR" },
      {
        name: "description",
        content:
          "Browse live AR photo experiences built with Aether: wedding AR albums, AR cards and augmented reality prints you can scan from your phone.",
      },
      { property: "og:title", content: "AR Gallery — Live Augmented Reality Photo Experiences" },
      {
        property: "og:description",
        content: "Browse live AR photo experiences built with Aether — scan and watch printed photos play video.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://aetherphoto.shop/gallery" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://aetherphoto.shop/gallery" }],
  }),

  errorComponent: ({ error }) => (
    <div className="p-8 text-center">Couldn't load gallery: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Not found</div>,
  component: Gallery,
});

function Gallery() {
  const items = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <h1 className="text-4xl font-serif italic mb-2">Public gallery</h1>
        <p className="text-sm text-muted-foreground mb-10">Published AR experiences from every workspace.</p>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published experiences yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((e: any) => (
              <Link
                key={e.slug}
                to="/ar/$slug"
                params={{ slug: e.slug }}
                search={{ mode: undefined }}
                className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden hover:border-primary/60 transition-colors group"
              >
                <div className="aspect-video bg-muted">
                  {e.cover_image_url ? (
                    <img src={e.cover_image_url} alt={e.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">
                      AR Experience
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{e.title}</div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                  </div>
                  {e.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
