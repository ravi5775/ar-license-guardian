import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

const ExperienceInput = z.object({
  title: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/i, "letters, numbers, dashes only"),
  description: z.string().max(2000).optional().nullable(),
  cover_image_url: z.string().url().optional().nullable().or(z.literal("")),
  marker_url: z.string().url().optional().nullable().or(z.literal("")),
  media_url: z.string().url().optional().nullable().or(z.literal("")),
  marker_path: z.string().optional().nullable(),
  marker_mind_path: z.string().optional().nullable(),
  media_path: z.string().optional().nullable(),
  media_type: z.enum(["video", "image", "model"]).default("video"),
  autoplay: z.boolean().default(true),
  loop_playback: z.boolean().default(true),
  published: z.boolean().default(false),
  /** Public gallery visibility is opt-in and always defaults to OFF. */
  show_in_gallery: z.boolean().default(false),
});

export const listMyExperiences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ar_experiences")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    // Cover image is optional: when none is set we preview the marker image.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return Promise.all(
      rows.map(async (row) => {
        if (row.cover_image_url || !row.marker_path) {
          return { ...row, cover_preview_url: row.cover_image_url ?? null };
        }
        const { data: s } = await supabaseAdmin.storage
          .from("ar-media")
          .createSignedUrl(row.marker_path, 60 * 60);
        return { ...row, cover_preview_url: s?.signedUrl ?? null };
      }),
    );
  });

export const createExperience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => ExperienceInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ar_experiences")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateExperience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => ExperienceInput.partial().extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("ar_experiences")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExperience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ar_experiences").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role);
  });

// Public read: returns experience + short-lived signed URLs for private assets.
// Restricted experiences require a valid QR token or a live PIN session.
export const getPublicExperience = createServerFn({ method: "GET" })
  .inputValidator((raw) =>
    z.object({ slug: z.string(), tok: z.string().max(200).optional().nullable() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAccess, signMedia } = await import("@/lib/content-access.server");

    const { data: row } = await supabaseAdmin
      .from("ar_experiences")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (!row) return null;

    const allowed = await resolveAccess({
      kind: "experience",
      slug: row.slug!,
      accessMode: row.access_mode,

      tok: data.tok,
    });

    if (!allowed) {
      // Nothing but the title leaks before the PIN is entered.
      return {
        locked: true as const,
        slug: row.slug,
        title: row.title,
      };
    }

    const marker_signed = row.marker_mind_path ? await signMedia(row.marker_mind_path) : null;
    const marker_image_signed = row.marker_path ? await signMedia(row.marker_path) : null;
    // Only the film itself is eligible for one-time delivery. The .mind target
    // and the marker image are re-fetched by the tracker on retry/reload, so a
    // one-shot URL there would break detection, not protect anything.
    const media_signed = row.media_path
      ? await signMedia(row.media_path, {
          singleUse: (row as { single_use_media?: boolean }).single_use_media === true,
          kind: "experience",
          slug: row.slug ?? "",
        })
      : null;

    return {
      ...row,
      locked: false as const,
      pin_hash: undefined,
      // Prefer signed private URLs; fall back to any public URLs already stored.
      marker_url: marker_signed ?? row.marker_url,
      marker_image_url: marker_image_signed,
      media_url: media_signed ?? row.media_url,
      // Cover image is optional — fall back to the printable marker image.
      cover_image_url: row.cover_image_url || marker_image_signed,
    };
  });

/** Hard server-side upload ceiling. Client-side compression is a convenience,
 *  never the enforcement point. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Signed upload URL for the admin console. Uses admin client because we
// enforce role at the handler level.
export const signMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        path: z.string().min(1),
        upsert: z.boolean().optional(),
        /** Declared byte size — checked again after the upload lands. */
        size: z.number().int().nonnegative().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { authorizeUploader, scopeUploadPath } = await import("@/lib/uploader-guard.server");
    const uploader = await authorizeUploader(context.supabase, context.userId);
    const scopedPath = scopeUploadPath(uploader, data.path);

    // §4.7 — no upload URL without valid licence state + attestation.
    const { checkPresignLicence } = await import("@/lib/adapters/presign-gate.server");
    const gate = await checkPresignLicence("upload");
    if (!gate.ok) throw new Error(gate.message);

    // Quota is checked BEFORE handing out an upload URL, so the client gets a
    // clear refusal instead of a silent storage failure mid-upload.
    const { data: usage } = await context.supabase.rpc("storage_usage", {
      _owner: context.userId,
    });
    const used = Number(usage?.[0]?.used_bytes ?? 0);
    const quota = Number(usage?.[0]?.quota_bytes ?? 0);
    if (quota > 0 && used + (data.size ?? 0) > quota) {
      const gb = (n: number) => (n / 1073741824).toFixed(2);
      throw new Error(
        `Storage full: this would use ${gb(used + (data.size ?? 0))} GB of your ${gb(quota)} GB allowance. Delete an old album or ask us to raise the limit.`,
      );
    }

    if (data.size != null && data.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File is too large (${(data.size / 1048576).toFixed(1)} MB). The limit is 50 MB — trim or compress the clip first.`,
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("ar-media")
      .createSignedUploadUrl(scopedPath, { upsert: data.upsert ?? true });
    if (error) throw new Error(error.message);
    return signed; // { signedUrl, token, path }
  });

/**
 * Backstop run after every upload: reads the object's real size from storage
 * and deletes it when it exceeds the hard limit, so a tampered or buggy client
 * cannot park an oversized file in the bucket.
 */
export const enforceMediaSize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ path: z.string().min(1) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { authorizeUploader, ownsUploadPath } = await import("@/lib/uploader-guard.server");
    const uploader = await authorizeUploader(context.supabase, context.userId);
    if (!ownsUploadPath(uploader, data.path)) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slash = data.path.lastIndexOf("/");
    const folder = slash === -1 ? "" : data.path.slice(0, slash);
    const name = slash === -1 ? data.path : data.path.slice(slash + 1);

    const { data: rows } = await supabaseAdmin.storage
      .from("ar-media")
      .list(folder, { search: name, limit: 1 });
    const size = (rows?.[0] as any)?.metadata?.size as number | undefined;

    if (size != null && size > MAX_UPLOAD_BYTES) {
      await supabaseAdmin.storage.from("ar-media").remove([data.path]);
      throw new Error(
        `Upload rejected: ${(size / 1048576).toFixed(1)} MB exceeds the 50 MB limit.`,
      );
    }

    // Record the object against its owner. Service-role write: a client must
    // never be able to under-report its own usage.
    await supabaseAdmin
      .from("media_objects")
      .upsert(
        { owner_id: context.userId, storage_path: data.path, bytes: size ?? 0 },
        { onConflict: "storage_path" },
      );

    return { ok: true as const, size: size ?? null };
  });

/**
 * Signed marker/media URLs for one of the caller's own experiences.
 * Lets the album builder reuse an existing AR experience instead of
 * re-uploading its photo and video. RLS on ar_experiences enforces ownership.
 */
export const signMyExperienceAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ar_experiences")
      .select("id, title, marker_path, media_path, media_type")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Experience not found");
    if (!row.marker_path || !row.media_path)
      throw new Error("That experience has no marker image or video stored");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("ar-media")
      .createSignedUrl(row.marker_path, 60 * 30);
    if (signErr) throw new Error(signErr.message);

    return {
      id: row.id,
      title: row.title,
      marker_path: row.marker_path,
      media_path: row.media_path,
      media_type: (row.media_type === "image" ? "image" : "video") as "image" | "video",
      marker_signed_url: signed?.signedUrl ?? null,
    };
  });
