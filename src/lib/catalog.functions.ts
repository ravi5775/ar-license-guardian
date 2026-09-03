import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CatalogInput = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/i, "letters, numbers, dashes only"),
  is_active: z.boolean().default(true),
});

const CatalogItemInput = z.object({
  id: z.string().uuid().optional(),
  catalog_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  sku: z.string().min(1).max(80),
  category: z.enum(["furniture", "paint", "flooring"]),
  glb_path: z.string().min(1),
  usdz_path: z.string().min(1),
  thumb_path: z.string().optional().nullable(),
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  depth_m: z.number().positive(),
  color_hex: z.string().max(32).optional().nullable(),
  placement: z.enum(["floor", "wall"]),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const listCatalogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("design_catalogs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => CatalogInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("design_catalogs")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => CatalogInput.partial().extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("design_catalogs")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("design_catalogs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCatalogItems = createServerFn({ method: "GET" })
  .validator((raw) => z.object({ catalogSlug: z.string().min(1) }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPresignedDownloadUrl } = await import("@/lib/storage.server");

    const { data: catalog } = (await supabaseAdmin
      .from("design_catalogs" as any)
      .select("id, slug")
      .eq("slug", data.catalogSlug)
      .eq("is_active", true)
      .maybeSingle()) as any;

    if (!catalog) return [] as any[];

    const { data: items, error } = (await supabaseAdmin
      .from("catalog_items" as any)
      .select("*")
      .eq("catalog_id", catalog.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })) as any;
    if (error) throw new Error(error.message);

    const rows = items ?? [];
    const signed = await Promise.all(
      rows.map(async (row: any) => ({
        ...row,
        glb_url: row.glb_path ? await createPresignedDownloadUrl(row.glb_path, 15 * 60) : null,
        usdz_url: row.usdz_path ? await createPresignedDownloadUrl(row.usdz_path, 15 * 60) : null,
        thumb_url: row.thumb_path
          ? await createPresignedDownloadUrl(row.thumb_path, 15 * 60)
          : null,
      })),
    );

    return signed.map(({ glb_url, usdz_url, thumb_url, ...row }) => ({
      ...row,
      glb_url,
      usdz_url,
      thumb_url,
    }));
  });

export const saveCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => CatalogItemInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const table = () => context.supabase.from("catalog_items" as any) as any;

    if (id) {
      // Update in place. RLS scopes the row to the caller, so a foreign id
      // simply matches nothing instead of silently creating a duplicate.
      const { data: row, error } = await table()
        .update(fields)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Catalog item not found or not editable by this account");
      return row;
    }

    const { data: row, error } = await table()
      .insert({ ...fields, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("catalog_items" as any) as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signCatalogUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        path: z.string().min(1),
        upsert: z.boolean().optional(),
        size: z.number().int().nonnegative().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { authorizeUploader, scopeUploadPath } = await import("@/lib/uploader-guard.server");
    const uploader = await authorizeUploader(context.supabase, context.userId);
    const scopedPath = scopeUploadPath(uploader, data.path);

    const { checkPresignLicence } = await import("@/lib/adapters/presign-gate.server");
    const gate = await checkPresignLicence("upload");
    if (!gate.ok) throw new Error(gate.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("ar-media")
      .createSignedUploadUrl(scopedPath, { upsert: data.upsert ?? true });
    if (error) throw new Error(error.message);
    return signed;
  });

export const logPlacement = createServerFn({ method: "POST" })
  .validator((raw) =>
    z
      .object({
        catalogItemId: z.string().uuid(),
        sessionId: z.string().min(6).max(64),
        placement: z.enum(["floor", "wall"]),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = (await supabaseAdmin
      .from("catalog_items" as any)
      .select("id, catalog_id")
      .eq("id", data.catalogItemId)
      .eq("is_active", true)
      .maybeSingle()) as any;

    if (!item) return { ok: false as const };

    const { error } = await supabaseAdmin.from("scan_events").insert({
      catalog_item_id: item.id,
      experience_id: null,
      album_id: null,
      event_type: "ar_place",
      session_id: data.sessionId,
      target_index: null,
      duration_ms: null,
      metadata: { placement: data.placement },
    });

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
