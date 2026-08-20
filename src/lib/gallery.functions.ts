import { createServerFn } from "@tanstack/react-start";

/**
 * Gallery visibility requires BOTH gates: the content must be public
 * (no PIN) AND the owner must have explicitly ticked "Show in public
 * gallery". New experiences default to hidden.
 *
 * Anonymous visitors have no read access to ar_experiences at all — an RLS
 * policy filters rows, not columns, so a public policy would hand out
 * pin_hash too. This runs server-side with an explicit safe column list.
 */
export const listPublicExperiences = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ar_experiences")
    .select("slug, title, description, cover_image_url")
    .eq("published", true)
    .eq("access_mode", "public")
    .eq("show_in_gallery", true)
    .order("created_at", { ascending: false })
    .limit(60);
  return data ?? [];
});
