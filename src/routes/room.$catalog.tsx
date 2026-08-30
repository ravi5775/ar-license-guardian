import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listCatalogItems } from "@/lib/catalog.functions";

export const Route = createFileRoute("/room/$catalog")({
  loader: async ({ params }) => {
    const items = await listCatalogItems({ data: { catalogSlug: params.catalog } });
    return { catalogSlug: params.catalog, items };
  },
  head: ({ loaderData }) => {
    const catalogSlug = loaderData?.catalogSlug ?? "room";
    return {
      meta: [
        { title: `Room AR — ${catalogSlug}` },
        {
          name: "description",
          content: "See furniture, paint, and flooring in your room using browser-based AR.",
        },
      ],
    };
  },
  component: RoomCatalogRoute,
});

function RoomCatalogRoute() {
  const { catalogSlug, items } = Route.useLoaderData();
  const [supportsAr, setSupportsAr] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<any>(items[0] ?? null);

  useEffect(() => {
    const xr = (navigator as Navigator & {
      xr?: { isSessionSupported: (mode: string) => Promise<boolean> };
    }).xr;
    if (!xr) {
      setSupportsAr(false);
      return;
    }

    void xr
      .isSessionSupported("immersive-ar")
      .then(setSupportsAr)
      .catch(() => setSupportsAr(false));
  }, []);

  useEffect(() => {
    if (!selected && items.length > 0) setSelected(items[0]);
  }, [items, selected]);

  const primary = useMemo(
    () => items.find((item: any) => item.id === selected?.id) ?? items[0] ?? null,
    [items, selected],
  );

  if (!items.length) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-8 text-center text-foreground">
        <div>
          <h1 className="text-3xl font-serif italic mb-2">This room catalog is empty</h1>
          <p className="text-sm text-muted-foreground">There are no active items available yet.</p>
          <Link to="/" className="mt-6 inline-block text-primary hover:underline text-sm">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Room AR</p>
            <h1 className="text-3xl font-serif italic">Catalog: {catalogSlug}</h1>
          </div>
          <Link to="/" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Back home
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-border/60 bg-card/40 p-3">
            <div className="mb-3 text-sm font-medium">Items</div>
            <div className="space-y-2">
              {items.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    primary?.id === item.id
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 hover:bg-accent"
                  }`}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.category} · {item.placement}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-border/60 bg-card/40 p-4 md:p-6">
            {supportsAr === false ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-serif italic">This browser can’t launch room AR yet</h2>
                <p className="text-sm text-muted-foreground">
                  WebXR immersive AR is unavailable here. Use a supported Android Chrome device or an
                  iPhone with Quick Look.
                </p>
                {primary?.usdz_url && (
                  <a
                    href={primary.usdz_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    Open USDZ fallback
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-serif italic">{primary?.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {primary?.width_m}m × {primary?.height_m}m × {primary?.depth_m}m
                    </p>
                  </div>
                  {supportsAr === true && (
                    <button
                      type="button"
                      className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                      Launch AR
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-4">
                  <div className="mb-3 text-sm text-muted-foreground">
                    {supportsAr === null
                      ? "Checking AR support…"
                      : "Supported browser detected — AR placement is ready."}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-64 rounded-xl bg-gradient-to-br from-primary/10 via-background to-muted/60" />
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>
                        <strong className="text-foreground">Category:</strong> {primary?.category}
                      </p>
                      <p>
                        <strong className="text-foreground">SKU:</strong> {primary?.sku}
                      </p>
                      <p>
                        <strong className="text-foreground">Placement:</strong> {primary?.placement}
                      </p>
                      <p>
                        <strong className="text-foreground">Color:</strong> {primary?.color_hex ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
