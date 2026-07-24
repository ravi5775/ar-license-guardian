import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

export const MAX_ALBUM_TARGETS = 20;

const TargetInput = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  marker_path: z.string().min(1),
  media_path: z.string().min(1),
  media_type: z.enum(["video", "image"]).default("video"),
  autoplay: z.boolean().default(true),
  loop_playback: z.boolean().default(true),
});

const AlbumInput = z.object({
  title: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/i, "letters, numbers, dashes only"),
  compiled_mind_path: z.string().min(1),
  published: z.boolean().default(true),
  targets: z.array(TargetInput).min(1).max(MAX_ALBUM_TARGETS),
});

export const listMyAlbums = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("albums")
      .select("*, ar_experiences(id, title, target_index)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => AlbumInput.parse(raw))
  .handler(async ({ data, context }) => {
    if (data.targets.length > MAX_ALBUM_TARGETS) {
      throw new Error(
        `Albums are limited to ${MAX_ALBUM_TARGETS} photos for reliable AR tracking — create a second album for additional photos.`,
      );
    }

    const { data: album, error } = await context.supabase
      .from("albums")
      .insert({
        title: data.title,
        slug: data.slug.toLowerCase(),
        owner_id: context.userId,
        compiled_mind_path: data.compiled_mind_path,
        target_count: data.targets.length,
        published: data.published,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const rows = data.targets.map((t, i) => ({
      album_id: album.id,
      target_index: i,
      slug: `${album.slug}-${i + 1}`,
      title: t.title,
      description: t.description ?? null,
      marker_path: t.marker_path,
      media_path: t.media_path,
      media_type: t.media_type,
      autoplay: t.autoplay,
      loop_playback: t.loop_playback,
      published: data.published,
      owner_id: context.userId,
    }));

    const { error: expError } = await context.supabase
      .from("ar_experiences")
      .insert(rows);
    if (expError) {
      await context.supabase.from("albums").delete().eq("id", album.id);
      throw new Error(expError.message);
    }

    return album;
  });

export const deleteAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("albums")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAlbumPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("albums")
      .update({ published: data.published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public read for the multi-target viewer — no auth middleware.
export const getPublicAlbum = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storage: undefined,
        },
      },
    );

    const { data: album } = await sb
      .from("albums")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (!album) return null;

    const { data: targets } = await sb
      .from("ar_experiences")
      .select("*")
      .eq("album_id", album.id)
      .order("target_index", { ascending: true });

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    async function sign(path: string | null | undefined) {
      if (!path) return null;
      const { data: s } = await supabaseAdmin.storage
        .from("ar-media")
        .createSignedUrl(path, 60 * 60);
      return s?.signedUrl ?? null;
    }

    const compiled_mind_url =
      (await sign(album.compiled_mind_path)) ?? album.compiled_mind_url ?? null;

    const signedTargets = await Promise.all(
      (targets ?? []).map(async (t) => ({
        id: t.id,
        title: t.title,
        target_index: t.target_index ?? 0,
        media_type: t.media_type,
        autoplay: t.autoplay,
        loop_playback: t.loop_playback,
        media_url: (await sign(t.media_path)) ?? t.media_url,
        marker_image_url: await sign(t.marker_path),
      })),
    );

    return {
      id: album.id,
      slug: album.slug,
      title: album.title,
      target_count: album.target_count,
      compiled_mind_url,
      targets: signedTargets,
    };
  });
