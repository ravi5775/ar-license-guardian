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
};

function ExperiencesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyExperiences);
  const createFn = useServerFn(createExperience);
  const updateFn = useServerFn(updateExperience);
  const deleteFn = useServerFn(deleteExperience);

  const { data: items = [] } = useQuery({ queryKey: ["experiences"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [qrFor, setQrFor] = useState<{ slug: string; title: string } | null>(null);

  const saveMut = useMutation({
    mutationFn: async (d: Draft) => {
      if (d.id) return updateFn({ data: d });
      return createFn({ data: d });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiences"] });
      toast.success("Saved");
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
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
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((e: any) => (
          <div key={e.id} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden group">
            <div className="aspect-video bg-muted relative">
              {e.cover_image_url ? (
                <img src={e.cover_image_url} alt={e.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-muted-foreground text-sm">
                  No cover image
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
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                >
                  <ExternalLink className="h-3 w-3" /> View
                </Link>
                <button
                  onClick={() => setQrFor({ slug: e.slug, title: e.title })}
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
                      media_path: e.media_path ?? "",
                      media_type: (e.media_type as Draft["media_type"]) ?? "video",
                      autoplay: e.autoplay,
                      loop_playback: e.loop_playback,
                      published: e.published,
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
          onCancel={() => setEditing(null)}
          onSave={() => saveMut.mutate(editing)}
          saving={saveMut.isPending}
        />
      )}

      {qrFor && <QRCodeDialog slug={qrFor.slug} title={qrFor.title} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function ExperienceModal({
  value,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
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
            onSave();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-muted-foreground">Title</span>
              <input required value={value.title} onChange={(e) => set("title", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Slug (URL)</span>
              <input required pattern="[a-z0-9-]+" value={value.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs" />
            </label>
          </div>
          <label className="text-sm block">
            <span className="text-muted-foreground">Description</span>
            <textarea rows={2} value={value.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>
          <label className="text-sm block">
            <span className="text-muted-foreground">Cover image URL (optional, for OG preview)</span>
            <input type="url" value={value.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>

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
