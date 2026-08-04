import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";

/**
 * Gallery visibility requires BOTH gates: the content must be public
 * (no PIN) AND the owner must have explicitly ticked "Show in public
 * gallery". New experiences default to hidden.
 */
const listPublicExperiences = createServerFn({ method: "GET" }).handler(async () => {
  // Anonymous visitors have no read access to ar_experiences at all — an
  // RLS policy filters rows, not columns, so a public policy would hand out
  // pin_hash too. This runs server-side with an explicit safe column list.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ar_experiences")
    .select("slug, title, description, cover_image_url")
    .eq("published", true)
    .eq("access_mode", "public")
    .eq("show_in_gallery", true)
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

/** Builds a responsive srcset for Unsplash-hosted covers so we never upscale. */
function coverSrcSet(url: string | null) {
  if (!url || !url.includes("images.unsplash.com")) return undefined;
  const base = url.split("?")[0];
  return [600, 1200, 1800]
    .map((w) => `${base}?auto=format&fit=crop&w=${w}&q=75 ${w}w`)
    .join(", ");
}

function Gallery() {
  const items = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-serif italic mb-2">Public gallery</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Published AR experiences. Scan the printed photo — no QR on the picture, no app install.
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published experiences yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
            {items.map((e: any) => (
              <Link
                key={e.slug}
                to="/ar/$slug"
                params={{ slug: e.slug }}
                search={{ mode: undefined }}
                className="relative isolate flex h-full min-h-[19rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition-colors hover:border-primary/60 group"
              >
                <div className="relative z-0 aspect-[4/3] w-full overflow-hidden bg-muted">
                  {e.cover_image_url ? (
                    <img
                      src={e.cover_image_url}
                      srcSet={coverSrcSet(e.cover_image_url)}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading="lazy"
                      decoding="async"
                      alt={e.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                      AR Experience
                    </div>
                  )}
                </div>
                <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1 p-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">{e.title}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </div>
                  {e.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {e.description}
                    </p>
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

