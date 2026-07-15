import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExperienceInput = z.object({
  title: z.string().min(1).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/i, "letters, numbers, dashes only"),
  description: z.string().max(2000).optional().nullable(),
  cover_image_url: z.string().url().optional().nullable().or(z.literal("")),
  marker_url: z.string().url().optional().nullable().or(z.literal("")),
  media_url: z.string().url().optional().nullable().or(z.literal("")),
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
    return data ?? [];
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
