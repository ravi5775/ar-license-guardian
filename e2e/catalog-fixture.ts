import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CatalogFixture = {
  email: string;
  password: string;
  catalogName: string;
  userId: string;
  catalogId: string;
  cleanup: () => Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; local Supabase e2e tests cannot run`);
  return value;
}

export async function createCatalogFixture(): Promise<CatalogFixture> {
  const supabase = createClient(
    process.env.E2E_SUPABASE_URL ?? requiredEnv("SUPABASE_URL"),
    requiredEnv("E2E_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-editor-${runId}@example.test`;
  const password = process.env.E2E_EDITOR_PASSWORD ?? "LocalE2E-password-123!";
  const catalogName = `E2E Catalog ${runId}`;

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "E2E Approved Editor" },
  });
  if (userError || !userData.user) throw userError ?? new Error("Could not create e2e user");

  const userId = userData.user.id;
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", userId);
  if (profileError) throw profileError;

  await ensureEditorRole(supabase, userId);

  const { data: catalog, error: catalogError } = await supabase
    .from("design_catalogs")
    .insert({ owner_id: userId, name: catalogName, slug: `e2e-${runId}`, is_active: true })
    .select("id")
    .single();
  if (catalogError || !catalog) throw catalogError ?? new Error("Could not create e2e catalog");

  const { error: itemError } = await supabase.from("catalog_items").insert([
    {
      catalog_id: catalog.id,
      owner_id: userId,
      name: "E2E Active Sofa",
      sku: `E2E-ACTIVE-${runId}`,
      category: "furniture",
      glb_path: "e2e/active.glb",
      usdz_path: "e2e/active.usdz",
      width_m: 1,
      height_m: 1,
      depth_m: 1,
      placement: "floor",
      sort_order: 1,
      is_active: true,
    },
    {
      catalog_id: catalog.id,
      owner_id: userId,
      name: "E2E Inactive Chair",
      sku: `E2E-INACTIVE-${runId}`,
      category: "furniture",
      glb_path: "e2e/inactive.glb",
      usdz_path: "e2e/inactive.usdz",
      width_m: 1,
      height_m: 1,
      depth_m: 1,
      placement: "floor",
      sort_order: 2,
      is_active: false,
    },
  ]);
  if (itemError) throw itemError;

  return {
    email,
    password,
    catalogName,
    userId,
    catalogId: catalog.id,
    cleanup: async () => {
      await supabase.auth.admin.deleteUser(userId);
    },
  };
}

async function ensureEditorRole(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "editor" }, { onConflict: "user_id,role" });
  if (error) throw error;
}
