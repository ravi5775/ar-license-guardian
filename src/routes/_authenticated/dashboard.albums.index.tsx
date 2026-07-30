import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listMyAlbums,
  deleteAlbum,
  setAlbumPublished,
  setAlbumGalleryVisibility,
} from "@/lib/albums.functions";
import { QueryState } from "@/components/QueryState";
import { QRCodeDialog } from "@/components/QRCodeDialog";
import { Images, Plus, QrCode, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/albums/")({
  component: AlbumsPage,
});

function AlbumsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyAlbums);
  const del = useServerFn(deleteAlbum);
  const publish = useServerFn(setAlbumPublished);
  const setGallery = useServerFn(setAlbumGalleryVisibility);
  const [qr, setQr] = useState<{ id: string; slug: string; title: string } | null>(null);

  const query = useQuery({
    queryKey: ["albums"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Album deleted");
      qc.invalidateQueries({ queryKey: ["albums"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const pubMut = useMutation({
    mutationFn: (v: { id: string; published: boolean }) => publish({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albums"] }),
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const galleryMut = useMutation({
    mutationFn: (v: { id: string; show: boolean }) => setGallery({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albums"] }),
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });



  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl md:text-3xl font-serif italic">Albums</h1>
        <Link
          to="/dashboard/albums/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New album
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        One QR code per album. Customers scan once, then point their camera at
        any photo in the album to play that photo's video.
      </p>

      <QueryState
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => query.refetch()}
        label="albums"
      />

      {query.data &&
        (query.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            <Images className="h-6 w-6 mx-auto mb-3 opacity-60" />
            No albums yet. Create one to generate a single album QR code.
          </div>
        ) : (
          <div className="space-y-3">
            {query.data.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border/60 bg-card/40 p-4 flex flex-wrap items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    /ar/album/{a.slug} · {a.target_count} photo
                    {a.target_count === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    pubMut.mutate({ id: a.id, published: !a.published })
                  }
                  className={`rounded-full px-3 py-1 text-xs border ${
                    a.published
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {a.published ? "Published" : "Draft"}
                </button>
                <button
                  disabled={galleryMut.isPending}
                  onClick={() =>
                    galleryMut.mutate({ id: a.id, show: !a.show_in_gallery })
                  }
                  title={
                    a.show_in_gallery
                      ? "Listed in the public gallery"
                      : "Hidden from the public gallery"
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border disabled:opacity-50 ${
                    a.show_in_gallery
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {a.show_in_gallery ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  Gallery
                </button>
                <button
                  onClick={() => setQr({ id: a.id, slug: a.slug, title: a.title })}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <QrCode className="h-3.5 w-3.5" /> QR
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${a.title}" and its photos?`))
                      delMut.mutate(a.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-destructive/40 text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}

      {qr && (
        <QRCodeDialog
          id={qr.id}
          slug={qr.slug}
          title={qr.title}
          kind="album"
          onSlugChange={() => qc.invalidateQueries({ queryKey: ["albums"] })}
          onClose={() => setQr(null)}
        />
      )}
    </div>
  );
}
