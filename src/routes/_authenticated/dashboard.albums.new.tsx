import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { compileAlbumTargets } from "@/lib/mindar-compiler";
import { uploadToArMedia } from "@/lib/upload";
import { createAlbum, MAX_ALBUM_TARGETS } from "@/lib/albums.functions";
import {
  listMyExperiences,
  signMyExperienceAssets,
} from "@/lib/experiences.functions";
import {
  AlertTriangle,
  Images,
  Library,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/albums/new")({
  component: NewAlbumPage,
});

interface Photo {
  file: File;
  previewUrl: string;
  title: string;
  video: File | null;
  /** When reused from an existing AR experience, its already-stored assets. */
  existing?: {
    marker_path: string;
    media_path: string;
    media_type: "video" | "image";
    label: string;
  };
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function errText(e: any) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (Array.isArray(e?.issues))
    return e.issues
      .map((i: any) => `${i.path?.join(".") || "field"}: ${i.message}`)
      .join(" · ");
  return e?.message ?? JSON.stringify(e);
}

function NewAlbumPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createAlbum);
  const fetchExperiences = useServerFn(listMyExperiences);
  const signAssets = useServerFn(signMyExperienceAssets);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const atCap = photos.length >= MAX_ALBUM_TARGETS;

  const experiences = useQuery({
    queryKey: ["experiences"],
    queryFn: () => fetchExperiences(),
    enabled: pickerOpen,
  });

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

  /** Pull a photo + video straight out of an existing AR experience. */
  async function importExperience(id: string) {
    if (atCap) return toast.error("Album is at its photo cap");
    setImporting(id);
    try {
      const info = await signAssets({ data: { id } });
      if (!info.marker_signed_url)
        throw new Error("Could not read that experience's marker image");
      const res = await fetch(info.marker_signed_url);
      if (!res.ok) throw new Error("Could not download the marker image");
      const blob = await res.blob();
      const ext = info.marker_path.split(".").pop() || "jpg";
      const file = new File([blob], `${slugify(info.title)}.${ext}`, {
        type: blob.type || "image/jpeg",
      });
      setPhotos((p) => [
        ...p,
        {
          file,
          previewUrl: URL.createObjectURL(file),
          title: info.title,
          video: null,
          existing: {
            marker_path: info.marker_path,
            media_path: info.media_path,
            media_type: info.media_type,
            label: info.title,
          },
        },
      ]);
      setPickerOpen(false);
    } catch (e: any) {
      toast.error(errText(e));
    } finally {
      setImporting(null);
    }
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
    setSaveError(null);
    const finalSlug = slugify(slug || title);
    if (!title.trim()) return setSaveError("Album name is required");
    if (finalSlug.length < 2)
      return setSaveError("Album link must be at least 2 characters");
    if (photos.length === 0) return setSaveError("Add at least one photo");
    if (photos.length > MAX_ALBUM_TARGETS)
      return setSaveError(
        `Albums are limited to ${MAX_ALBUM_TARGETS} photos for reliable AR tracking — create a second album for additional photos.`,
      );
    const missing = photos.findIndex((p) => !p.video && !p.existing);
    if (missing !== -1)
      return setSaveError(
        `Photo ${missing + 1} has no video yet — upload one or import an existing experience.`,
      );

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
        const p = photos[i];
        setStage(`Preparing photo ${i + 1} of ${photos.length}…`);
        const marker_path =
          p.existing?.marker_path ?? (await uploadToArMedia(p.file, "markers"));
        const media_path =
          p.existing && !p.video
            ? p.existing.media_path
            : await uploadToArMedia(p.video!, "media");
        targets.push({
          title: p.title || `Photo ${i + 1}`,
          marker_path,
          media_path,
          media_type: (p.video
            ? "video"
            : (p.existing?.media_type ?? "video")) as "video" | "image",
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
      console.error("Album save failed", e);
      setSaveError(errText(e));
      toast.error(errText(e));
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
        Upload up to {MAX_ALBUM_TARGETS} photos (or reuse existing AR
        experiences), assign a video to each, and we'll compile them into a
        single AR marker file. One QR code covers the whole album.
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
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={atCap || saving}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          <Library className="h-4 w-4" /> Use existing experience
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

      {pickerOpen && (
        <div className="mb-4 rounded-xl border border-border/60 bg-card/40 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Pick an AR experience — its marker photo and video are reused, so
            nothing is uploaded twice.
          </p>
          {experiences.isLoading && (
            <p className="text-xs text-muted-foreground">Loading experiences…</p>
          )}
          {experiences.error && (
            <p className="text-xs text-destructive">
              {errText(experiences.error)}
            </p>
          )}
          {experiences.data && experiences.data.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No AR experiences yet.
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {(experiences.data ?? [])
              .filter((x: any) => x.marker_path && x.media_path)
              .map((x: any) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => importExperience(x.id)}
                    disabled={!!importing || atCap}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {x.cover_preview_url ? (
                      <img
                        src={x.cover_preview_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-muted">
                        <Images className="h-4 w-4 opacity-60" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{x.title}</span>
                    {importing === x.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

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
                  {p.existing && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      From experience
                    </span>
                  )}
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
                    {p.existing
                      ? "Video (already attached — upload to replace)"
                      : "Video for this photo"}
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
                {p.video ? (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.video.name} · {(p.video.size / 1048576).toFixed(1)} MB
                  </p>
                ) : p.existing ? (
                  <p className="text-[11px] text-muted-foreground truncate">
                    Reusing video from “{p.existing.label}”
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {saveError && (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{saveError}</span>
        </div>
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
