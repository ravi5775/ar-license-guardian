/**
 * RLS regression tests — cross-tenant isolation.
 *
 * These exist because of a real regression: `ar_experiences` and `albums`
 * once allowed ANY authenticated user to read every published row, so one
 * client could see another client's content in their dashboard.
 *
 * The tests run against the real database through the Data API with real
 * user sessions, so they exercise the actual policies, not a mock.
 *
 * Run:  bunx vitest run tests/rls-regression.test.ts
 * Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY
 *        (service key is used ONLY to create/delete the two throwaway
 *        test users and to clean up rows afterwards).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ready = !!(URL_ && PUBLISHABLE && SERVICE);

/**
 * New-format `sb_publishable_` / `sb_secret_` keys are opaque, not JWTs.
 * PostgREST rejects them when sent as `Authorization: Bearer <key>`, so
 * strip that header and rely on `apikey` (this mirrors the app clients).
 */
function client(key: string) {
  return createClient(URL_!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type Tenant = {
  id: string;
  email: string;
  db: SupabaseClient;
  albumId: string;
  albumSlug: string;
  experienceId: string;
  experienceSlug: string;
};

const stamp = Date.now();
let admin: SupabaseClient;
let alice: Tenant;
let bob: Tenant;

async function createTenant(label: string): Promise<Tenant> {
  const email = `rls-${label}-${stamp}@aether-rls-test.invalid`;
  const password = `Test-${stamp}-${label}!x`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`could not create test user: ${createError?.message}`);
  }

  const db = client(PUBLISHABLE!);
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`could not sign in test user: ${signInError.message}`);

  const albumSlug = `rls-${label}-album-${stamp}`;
  const { data: album, error: albumError } = await db
    .from("albums")
    .insert({
      owner_id: created.user.id,
      title: `RLS ${label} album`,
      slug: albumSlug,
      published: true, // published on purpose: the regression was about these
    })
    .select("id")
    .single();
  if (albumError) throw new Error(`could not insert album: ${albumError.message}`);

  const experienceSlug = `rls-${label}-exp-${stamp}`;
  const { data: exp, error: expError } = await db
    .from("ar_experiences")
    .insert({
      owner_id: created.user.id,
      title: `RLS ${label} experience`,
      slug: experienceSlug,
      album_id: album.id,
      published: true,
    })
    .select("id")
    .single();
  if (expError) throw new Error(`could not insert experience: ${expError.message}`);

  return {
    id: created.user.id,
    email,
    db,
    albumId: album.id,
    albumSlug,
    experienceId: exp.id,
    experienceSlug,
  };
}

beforeAll(async () => {
  if (!ready) return;
  admin = client(SERVICE!);
  alice = await createTenant("alice");
  bob = await createTenant("bob");
}, 60_000);

afterAll(async () => {
  if (!ready || !admin) return;
  for (const t of [alice, bob]) {
    if (!t) continue;
    await admin.from("ar_experiences").delete().eq("owner_id", t.id);
    await admin.from("albums").delete().eq("owner_id", t.id);
    await admin.auth.admin.deleteUser(t.id).catch(() => {});
  }
}, 60_000);

describe.runIf(ready)("RLS: cross-tenant isolation", () => {
  it("a client sees only their own experiences when listing", async () => {
    const { data, error } = await alice.db.from("ar_experiences").select("id, owner_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.owner_id === alice.id)).toBe(true);
    expect(data!.some((r) => r.id === bob.experienceId)).toBe(false);
  });

  it("a client sees only their own albums when listing", async () => {
    const { data, error } = await alice.db.from("albums").select("id, owner_id");
    expect(error).toBeNull();
    expect(data!.every((r) => r.owner_id === alice.id)).toBe(true);
    expect(data!.some((r) => r.id === bob.albumId)).toBe(false);
  });

  it("cannot read another client's published experience by id", async () => {
    const { data } = await alice.db
      .from("ar_experiences")
      .select("id")
      .eq("id", bob.experienceId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("cannot read another client's published album by id or slug", async () => {
    const byId = await alice.db.from("albums").select("id").eq("id", bob.albumId).maybeSingle();
    expect(byId.data).toBeNull();
    const bySlug = await alice.db
      .from("albums")
      .select("id")
      .eq("slug", bob.albumSlug)
      .maybeSingle();
    expect(bySlug.data).toBeNull();
  });

  it("cannot update or delete another client's rows", async () => {
    const upd = await alice.db
      .from("ar_experiences")
      .update({ title: "hijacked" })
      .eq("id", bob.experienceId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const del = await alice.db.from("albums").delete().eq("id", bob.albumId).select("id");
    expect(del.data ?? []).toHaveLength(0);

    // Bob's rows are untouched.
    const check = await bob.db.from("ar_experiences").select("title").eq("id", bob.experienceId).single();
    expect(check.data!.title).not.toBe("hijacked");
  });

  it("cannot insert a row owned by another client", async () => {
    const { error } = await alice.db.from("albums").insert({
      owner_id: bob.id,
      title: "spoofed",
      slug: `rls-spoof-${stamp}`,
      published: true,
    });
    expect(error).not.toBeNull();
  });

  it("both tenants are isolated symmetrically", async () => {
    const { data } = await bob.db.from("ar_experiences").select("id, owner_id");
    expect(data!.every((r) => r.owner_id === bob.id)).toBe(true);
    expect(data!.some((r) => r.id === alice.experienceId)).toBe(false);
  });

  it("anonymous visitors can read published rows (public AR viewer still works)", async () => {
    const anon = client(PUBLISHABLE!);
    const { data, error } = await anon
      .from("ar_experiences")
      .select("id, slug")
      .eq("id", bob.experienceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(bob.experienceId);
  });

  it("anonymous visitors cannot read unpublished rows", async () => {
    // Unpublish Alice's experience as Alice, then check the anon view.
    await alice.db.from("ar_experiences").update({ published: false }).eq("id", alice.experienceId);
    const anon = client(PUBLISHABLE!);
    const { data } = await anon
      .from("ar_experiences")
      .select("id")
      .eq("id", alice.experienceId)
      .maybeSingle();
    expect(data).toBeNull();

    // The owner can still see their own unpublished row.
    const own = await alice.db
      .from("ar_experiences")
      .select("id")
      .eq("id", alice.experienceId)
      .maybeSingle();
    expect(own.data?.id).toBe(alice.experienceId);
  });

  it("a non-admin cannot read licences, activations or the audit log", async () => {
    for (const table of ["licenses", "license_activations", "audit_log"] as const) {
      const { data, error } = await alice.db.from(table).select("id");
      // Either blocked outright or filtered to nothing — never another
      // tenant's licensing data.
      expect(error ? true : (data ?? []).length === 0).toBe(true);
    }
  });

  it("a non-admin cannot grant themselves the admin role", async () => {
    const { error } = await alice.db
      .from("user_roles")
      .insert({ user_id: alice.id, role: "admin" });
    expect(error).not.toBeNull();
  });
});
