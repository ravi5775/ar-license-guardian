import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Client "projects" are folders above albums/experiences (e.g. one wedding).
 * They are NOT a tenancy boundary — isolation still comes from owner_id RLS.
 */

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [projects, albums, experiences] = await Promise.all([
      context.supabase.from("projects").select("*").order("created_at", { ascending: false }),
      context.supabase
        .from("albums")
        .select("id, title, slug, project_id, published")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("ar_experiences")
        .select("id, title, slug, project_id, published, album_id")
        .is("album_id", null)
        .order("created_at", { ascending: false }),
    ]);

    if (projects.error) throw new Error(projects.error.message);
    if (albums.error) throw new Error(albums.error.message);
    if (experiences.error) throw new Error(experiences.error.message);

    return {
      projects: projects.data ?? [],
      albums: albums.data ?? [],
      experiences: experiences.data ?? [],
    };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({
        name: data.name,
        description: data.description ?? null,
        owner_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(120) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Deleting a folder never deletes content — items simply become unfiled. */
export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        kind: z.enum(["album", "experience"]),
        id: z.string().uuid(),
        project_id: z.string().uuid().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "album" ? "albums" : "ar_experiences";
    const { error } = await context.supabase
      .from(table)
      .update({ project_id: data.project_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Album folders cascade to the photos inside them.
    if (data.kind === "album") {
      await context.supabase
        .from("ar_experiences")
        .update({ project_id: data.project_id })
        .eq("album_id", data.id);
    }
    return { ok: true };
  });
