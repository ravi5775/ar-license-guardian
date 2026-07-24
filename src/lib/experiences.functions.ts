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
  .inputValidator((raw) =>
    ExperienceInput.partial().extend({ id: z.string().uuid() }).parse(raw),
  )
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
    const { error } = await context.supabase
      .from("ar_experiences")
      .delete()
      .eq("id", data.id);
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

// Public read: returns experience + signed URLs for private-bucket assets.
// Called from public /ar/$slug loader — no auth middleware.
export const getPublicExperience = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { data: row } = await sb
      .from("ar_experiences")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (!row) return null;

    // Sign private-bucket assets via admin (RLS blocks anon reads on ar-media).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    async function sign(path: string | null | undefined) {
      if (!path) return null;
      const { data: s } = await supabaseAdmin.storage
        .from("ar-media")
        .createSignedUrl(path, 60 * 60);
      return s?.signedUrl ?? null;
    }

    const marker_signed = row.marker_mind_path
      ? await sign(row.marker_mind_path)
      : null;
    const marker_image_signed = row.marker_path ? await sign(row.marker_path) : null;
    const media_signed = row.media_path ? await sign(row.media_path) : null;

    return {
      ...row,
      // Prefer signed private URLs; fall back to any public URLs already stored.
      marker_url: marker_signed ?? row.marker_url,
      marker_image_url: marker_image_signed,
      media_url: media_signed ?? row.media_url,
    };
  });

// Signed upload URL for the admin console. Uses admin client because we
// enforce role at the handler level.
export const signMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        path: z.string().min(1),
        upsert: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("ar-media")
      .createSignedUploadUrl(data.path, { upsert: data.upsert ?? true });
    if (error) throw new Error(error.message);
    return signed; // { signedUrl, token, path }
  });
