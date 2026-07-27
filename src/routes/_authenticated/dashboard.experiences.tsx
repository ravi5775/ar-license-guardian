import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMyExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
} from "@/lib/experiences.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ExternalLink, Trash2, Pencil, X, QrCode } from "lucide-react";
import { MediaUploader } from "@/components/MediaUploader";
import { QRCodeDialog } from "@/components/QRCodeDialog";
import { QueryState } from "@/components/QueryState";

export const Route = createFileRoute("/_authenticated/dashboard/experiences")({
  component: ExperiencesPage,
});

type Draft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  marker_path: string;
  marker_mind_path: string;
  media_path: string;
  media_type: "video" | "image" | "model";
  autoplay: boolean;
  loop_playback: boolean;
  published: boolean;
  show_in_gallery: boolean;
};

const empty: Draft = {
  title: "",
  slug: "",
  description: "",
  cover_image_url: "",
  marker_path: "",
  marker_mind_path: "",
  media_path: "",
  media_type: "video",
  autoplay: true,
  loop_playback: true,
  published: false,
  show_in_gallery: false,
};

function ExperiencesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyExperiences);
  const createFn = useServerFn(createExperience);
  const updateFn = useServerFn(updateExperience);
  const deleteFn = useServerFn(deleteExperience);

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ["experiences"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [qrFor, setQrFor] = useState<{ id: string; slug: string; title: string } | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async (d: Draft) => {
      setSaveError(null);
      if (d.id) return updateFn({ data: d });
      return createFn({ data: d });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiences"] });
      toast.success("Saved");
      setSaveError(null);
      setEditing(null);
    },
    onError: (e: any) => {
      const detail =
        e?.body?.message ??
        e?.response?.statusText ??
        (e?.issues ? JSON.stringify(e.issues, null, 2) : null) ??
        e?.message ??
        JSON.stringify(e);
      setSaveError(String(detail));
      toast.error(String(detail).slice(0, 160));
      // eslint-disable-next-line no-console
      console.error("[experiences] save failed", e);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiences"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif italic">AR Experiences</h1>
          <p className="text-sm text-muted-foreground">
            Upload a marker image + overlay media. Print the QR to launch.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New experience
        </button>
      </div>

      <div className="mb-6 empty:mb-0">
        <QueryState isLoading={isLoading} error={error} onRetry={() => refetch()} label="experiences" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((e: any) => (
          <div key={e.id} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden group">
            <div className="aspect-video bg-muted relative">
              {e.cover_image_url || e.cover_preview_url ? (
                <img
                  src={e.cover_image_url || e.cover_preview_url}
                  alt={e.title}
                  className="w-full h-full object-contain bg-black/20"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-muted-foreground text-sm">
                  No marker image yet
                </div>
              )}

              <span
                className={`absolute top-3 right-3 text-xs px-2 py-1 rounded-full ${
                  e.published ? "bg-primary/90 text-primary-foreground" : "bg-black/60 text-white"
                }`}
              >
                {e.published ? "Published" : "Draft"}
              </span>
            </div>
            <div className="p-4">
              <div className="font-semibold">{e.title}</div>
              <div className="text-xs text-muted-foreground mb-3">/ar/{e.slug}</div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/ar/$slug"
                  params={{ slug: e.slug }}
                  search={{ mode: undefined }}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                >
                  <ExternalLink className="h-3 w-3" /> View
                </Link>
                <button
                  onClick={() => setQrFor({ id: e.id, slug: e.slug, title: e.title })}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                >
                  <QrCode className="h-3 w-3" /> QR
                </button>
                <button
                  onClick={() =>
                    setEditing({
                      id: e.id,
                      title: e.title,
                      slug: e.slug,
                      description: e.description ?? "",
                      cover_image_url: e.cover_image_url ?? "",
                      marker_path: e.marker_path ?? "",
                      marker_mind_path: e.marker_mind_path ?? "",
                      media_path: e.media_path ?? "",
                      media_type: (e.media_type as Draft["media_type"]) ?? "video",
                      autoplay: e.autoplay,
                      loop_playback: e.loop_playback,
                      published: e.published,
                      show_in_gallery: e.show_in_gallery ?? false,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => confirm("Delete this experience?") && delMut.mutate(e.id)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-16 text-sm text-muted-foreground">
            No experiences yet — click "New experience" to get started.
          </div>
        )}
      </div>

      {editing && (
        <ExperienceModal
          value={editing}
          onChange={setEditing}
          existingSlugs={items
            .filter((e: any) => e.id !== editing.id)
            .map((e: any) => e.slug)}
          onCancel={() => {
            setSaveError(null);
            setEditing(null);
          }}
          onSave={(d) => saveMut.mutate(d)}
          saving={saveMut.isPending}
          errorText={saveError}
        />
      )}

      {qrFor && (
        <QRCodeDialog
          id={qrFor.id}
          slug={qrFor.slug}
          title={qrFor.title}
          onSlugChange={() => qc.invalidateQueries({ queryKey: ["experiences"] })}
          onClose={() => setQrFor(null)}
        />
      )}
    </div>
  );
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlug(base: string, taken: string[]) {
  const root = base || "experience";
  if (!taken.includes(root)) return root;
  let i = 2;
  while (taken.includes(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

function ExperienceModal({
  value,
  onChange,
  existingSlugs,
  onCancel,
  onSave,
  saving,
  errorText,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
  existingSlugs: string[];
  onCancel: () => void;
  onSave: (d: Draft) => void;
  saving: boolean;
  errorText?: string | null;
}) {
  const [slugTouched, setSlugTouched] = useState(Boolean(value.slug));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif italic">{value.id ? "Edit" : "New"} experience</h2>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const slug = uniqueSlug(
              slugify(value.slug || value.title),
              existingSlugs,
            );
            onSave({ ...value, slug });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-muted-foreground">Title</span>
              <input
                required
                value={value.title}
                onChange={(e) => {
                  const title = e.target.value;
                  onChange({
                    ...value,
                    title,
                    slug: slugTouched ? value.slug : slugify(title),
                  });
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Slug (URL) — auto-generated</span>
              <input
                value={value.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
                placeholder="auto from title"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>
          <label className="text-sm block">
            <span className="text-muted-foreground">Description</span>
            <textarea rows={2} value={value.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>
          <details className="rounded-md border border-border/60 bg-background/40 p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Cover image — optional. Leave empty and the marker image below is used automatically.
            </summary>
            <label className="text-sm block mt-3">
              <span className="text-muted-foreground">Custom cover image URL (advanced)</span>
              <input type="url" value={value.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
          </details>


          <div className="grid grid-cols-2 gap-4">
            <MediaUploader
              label="Marker image (JPG/PNG — printable target)"
              accept="image/*"
              prefix="markers"
              currentPath={value.marker_path}
              onUploaded={(path) => set("marker_path", path)}
            />
            <MediaUploader
              label="Overlay media (video or image)"
              accept="video/*,image/*"
              prefix="media"
              currentPath={value.media_path}
              onUploaded={(path) => set("media_path", path)}
            />
          </div>

          <MediaUploader
            label="Marker (.mind) — compiled tracker file for true AR tracking"
            accept=".mind,application/octet-stream"
            prefix="mind"
            currentPath={value.marker_mind_path}
            onUploaded={(path) => set("marker_mind_path", path)}
          />
          <p className="-mt-2 text-xs text-muted-foreground">
            Compile your marker image at{" "}
            <a
              href="https://hiukim.github.io/mind-ar-js-doc/tools/compile"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              MindAR compiler
            </a>{" "}
            → download <code>targets.mind</code> → upload here. Without this, the viewer
            falls back to plain camera + overlay (no image tracking).
          </p>


          <div className="grid grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="text-muted-foreground">Media type</span>
              <select value={value.media_type} onChange={(e) => set("media_type", e.target.value as Draft["media_type"])} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2">
                <option value="video">Video</option>
                <option value="image">Image</option>
              </select>
            </label>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input type="checkbox" checked={value.autoplay} onChange={(e) => set("autoplay", e.target.checked)} />
              Autoplay
            </label>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input type="checkbox" checked={value.loop_playback} onChange={(e) => set("loop_playback", e.target.checked)} />
              Loop
            </label>
          </div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={value.published} onChange={(e) => set("published", e.target.checked)} />
            Published (visible to public)
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.show_in_gallery}
              onChange={(e) => set("show_in_gallery", e.target.checked)}
            />
            Show in the public gallery (off by default — PIN-protected items are never listed)
          </label>
          {errorText && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <div className="text-sm font-medium text-destructive">Save failed</div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-destructive/90">
                {errorText}
              </pre>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent">
              Cancel
            </button>
            <button disabled={saving} type="submit" className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
