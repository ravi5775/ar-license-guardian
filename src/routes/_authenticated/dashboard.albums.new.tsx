import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { compileAlbumTargets } from "@/lib/mindar-compiler";
import { uploadToArMedia } from "@/lib/upload";
import { createAlbum, MAX_ALBUM_TARGETS } from "@/lib/albums.functions";
import { AlertTriangle, Images, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/albums/new")({
  component: NewAlbumPage,
});

interface Photo {
  file: File;
  previewUrl: string;
  title: string;
  video: File | null;
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function NewAlbumPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createAlbum);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<string>("");

  const atCap = photos.length >= MAX_ALBUM_TARGETS;

  function addFiles(files: FileList) {
    const incoming = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    const room = MAX_ALBUM_TARGETS - photos.length;
    if (incoming.length > room) {
      toast.error(
        `Albums are limited to ${MAX_ALBUM_TARGETS} photos for reliable AR tracking — create a second album for additional photos.`,
      );
    }
    const accepted = incoming.slice(0, Math.max(0, room)).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      title: file.name.replace(/\.[^.]+$/, ""),
      video: null as File | null,
    }));
    setPhotos((p) => [...p, ...accepted]);
  }

  function update(i: number, patch: Partial<Photo>) {
    setPhotos((p) => p.map((ph, idx) => (idx === i ? { ...ph, ...patch } : ph)));
  }

  function remove(i: number) {
    setPhotos((p) => {
      URL.revokeObjectURL(p[i].previewUrl);
      return p.filter((_, idx) => idx !== i);
    });
  }

  async function save() {
    const finalSlug = slugify(slug || title);
    if (!title.trim()) return toast.error("Album name is required");
    if (finalSlug.length < 2) return toast.error("Album link is too short");
    if (photos.length === 0) return toast.error("Add at least one photo");
    if (photos.length > MAX_ALBUM_TARGETS)
      return toast.error(
        `Albums are limited to ${MAX_ALBUM_TARGETS} photos for reliable AR tracking — create a second album for additional photos.`,
      );
    if (photos.some((p) => !p.video))
      return toast.error("Assign a video to every photo");

    setSaving(true);
    try {
      setStage("Compiling AR targets…");
      setCompileProgress(0);
      const mindBlob = await compileAlbumTargets(
        photos.map((p) => p.file),
        setCompileProgress,
      );
      setCompileProgress(100);

      setStage("Uploading compiled marker…");
      const compiled_mind_path = await uploadToArMedia(
        mindBlob,
        "markers",
        `${finalSlug}.mind`,
      );

      const targets = [];
      for (let i = 0; i < photos.length; i++) {
        setStage(`Uploading photo ${i + 1} of ${photos.length}…`);
        const marker_path = await uploadToArMedia(photos[i].file, "markers");
        const media_path = await uploadToArMedia(photos[i].video!, "media");
        targets.push({
          title: photos[i].title || `Photo ${i + 1}`,
          marker_path,
          media_path,
          media_type: "video" as const,
          autoplay: true,
          loop_playback: true,
        });
      }

      setStage("Saving album…");
      await create({
        data: {
          title: title.trim(),
          slug: finalSlug,
          compiled_mind_path,
          published: true,
          targets,
        },
      });

      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album created — one QR code covers all photos");
      navigate({ to: "/dashboard/albums" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create album");
    } finally {
      setSaving(false);
      setCompileProgress(null);
      setStage("");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-serif italic mb-1">New album</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload up to {MAX_ALBUM_TARGETS} photos, assign a video to each, and
        we'll compile them into a single AR marker file. One QR code covers the
        whole album.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <label className="block">
          <span className="text-xs text-muted-foreground">Album name</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slug) setSlug(slugify(e.target.value));
            }}
            placeholder="Priya & Arjun — Wedding"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Album link</span>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="priya-arjun-wedding"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={atCap || saving}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> Add photos
        </button>
        <span className="text-xs text-muted-foreground">
          {photos.length} / {MAX_ALBUM_TARGETS} photos
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {atCap && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          Albums are limited to {MAX_ALBUM_TARGETS} photos for reliable AR
          tracking — create a second album (and QR code) for additional photos.
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          <Images className="h-6 w-6 mx-auto mb-3 opacity-60" />
          No photos yet. Upload the printed photos customers will point their
          camera at.
        </div>
      ) : (
        <ol className="space-y-3">
          {photos.map((p, i) => (
            <li
              key={i}
              className="rounded-xl border border-border/60 bg-card/40 p-3 flex gap-3 items-start"
            >
              <img
                src={p.previewUrl}
                alt=""
                className="h-20 w-20 rounded-md object-cover shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px]">
                    Target {i + 1}
                  </span>
                  <button
                    onClick={() => remove(i)}
                    disabled={saving}
                    className="ml-auto p-1 rounded-md hover:bg-accent"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={p.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Photo title"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                />
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">
                    Video for this photo
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) =>
                      update(i, { video: e.target.files?.[0] ?? null })
                    }
                    className="mt-1 block w-full text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
                  />
                </label>
                {p.video && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.video.name} · {(p.video.size / 1048576).toFixed(1)} MB
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Working…" : "Compile & create album"}
        </button>
        {stage && (
          <span className="text-xs text-muted-foreground">
            {stage}
            {compileProgress !== null && compileProgress < 100
              ? ` ${compileProgress}%`
              : ""}
          </span>
        )}
      </div>
    </div>
  );
}
