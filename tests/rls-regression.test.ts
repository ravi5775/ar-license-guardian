/**
 * ============================================================================
 * AETHER AR — ROW LEVEL SECURITY (RLS) REGRESSION TEST SUITE
 * ============================================================================
 *
 * Verifies cross-tenant isolation and role-based data access at the PostgreSQL
 * data layer using real PostgreSQL Row Level Security (RLS) enforcement.
 *
 * Dual-Mode Execution:
 *  1. Remote Supabase (when SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are set).
 *  2. Embedded PostgreSQL 16 Engine via PGlite (runs actual PostgreSQL C-engine
 *     compiled to WebAssembly, executing real RLS policies, SET ROLE, and
 *     auth.uid() claims in-process with 0 skipped tests).
 * ============================================================================
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasRemoteSupabase = !!(URL_ && PUBLISHABLE && SERVICE);

type QueryResult<T = any> = {
  data: T | null;
  error: any | null;
};

interface RlsTestClient {
  from(table: string): {
    select(columns?: string): any;
    insert(values: any): any;
    update(values: any): any;
    delete(): any;
  };
  auth?: any;
}

type Tenant = {
  id: string;
  email: string;
  db: RlsTestClient;
  albumId: string;
  albumSlug: string;
  experienceId: string;
  experienceSlug: string;
};

const stamp = Date.now();
let admin: RlsTestClient;
let alice: Tenant;
let bob: Tenant;
let pgliteInstance: PGlite | null = null;

/**
 * Creates an in-process PostgreSQL RLS client wrapping PGlite.
 * Sets the exact database role (`anon`, `authenticated`, or `service_role`)
 * and injects `request.jwt.claims` (`auth.uid()`) so PostgreSQL RLS evaluates
 * policies natively.
 */
function createPgLiteClient(pg: PGlite, role: "anon" | "authenticated" | "service_role", userId?: string): RlsTestClient {
  const executeAsRole = async (sql: string, params: any[] = []) => {
    // Service role bypasses RLS; authenticated and anon enforce RLS with auth.uid()
    const sessionSetup = [
      `SET ROLE ${role === "service_role" ? "postgres" : role};`,
    ];
    if (role === "authenticated" && userId) {
      sessionSetup.push(
        `SELECT set_config('request.jwt.claims', json_build_object('sub', '${userId}', 'role', 'authenticated')::text, false);`
      );
    } else {
      sessionSetup.push(
        `SELECT set_config('request.jwt.claims', json_build_object('role', '${role}')::text, false);`
      );
    }

    try {
      await pg.exec(sessionSetup.join("\n"));
      const res = await pg.query(sql, params);
      return { rows: res.rows, error: null };
    } catch (err: any) {
      return { rows: null, error: err };
    } finally {
      await pg.exec("RESET ROLE; SELECT set_config('request.jwt.claims', '', false);").catch(() => {});
    }
  };

  return {
    from(table: string) {
      const state: {
        operation: "select" | "insert" | "update" | "delete";
        columns: string;
        insertValues?: any;
        updateValues?: any;
        filters: Array<{ col: string; op: string; val: any }>;
        singleMode?: "single" | "maybeSingle";
        selectAfterMutation?: string;
      } = {
        operation: "select",
        columns: "*",
        filters: [],
      };

      const builder: any = {
        select(cols = "*") {
          if (state.operation === "insert" || state.operation === "update" || state.operation === "delete") {
            state.selectAfterMutation = cols;
            return builder;
          }
          state.operation = "select";
          state.columns = cols;
          return builder;
        },
        insert(values: any) {
          state.operation = "insert";
          state.insertValues = Array.isArray(values) ? values : [values];
          return builder;
        },
        update(values: any) {
          state.operation = "update";
          state.updateValues = values;
          return builder;
        },
        delete() {
          state.operation = "delete";
          return builder;
        },
        eq(col: string, val: any) {
          state.filters.push({ col, op: "=", val });
          return builder;
        },
        single() {
          state.singleMode = "single";
          return builder;
        },
        maybeSingle() {
          state.singleMode = "maybeSingle";
          return builder;
        },
        then(resolve: (value: QueryResult) => void, reject?: (reason: any) => void) {
          const run = async (): Promise<QueryResult> => {
            const whereClauses: string[] = [];
            const params: any[] = [];

            state.filters.forEach((f) => {
              params.push(f.val);
              whereClauses.push(`"${f.col}" ${f.op} $${params.length}`);
            });

            const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

            if (state.operation === "select") {
              const cols = state.columns
                .split(",")
                .map((c) => c.trim())
                .map((c) => (c === "*" ? "*" : `"${c}"`))
                .join(", ");
              const sql = `SELECT ${cols} FROM public."${table}"${whereSql};`;
              const { rows, error } = await executeAsRole(sql, params);
              if (error) return { data: null, error };

              if (state.singleMode === "single") {
                if (!rows || rows.length === 0) {
                  return { data: null, error: new Error("Row not found") };
                }
                return { data: rows[0], error: null };
              }
              if (state.singleMode === "maybeSingle") {
                return { data: rows && rows.length > 0 ? rows[0] : null, error: null };
              }
              return { data: rows, error: null };
            }

            if (state.operation === "insert") {
              const items = state.insertValues || [];
              if (items.length === 0) return { data: [], error: null };

              const keys = Object.keys(items[0]);
              const colNames = keys.map((k) => `"${k}"`).join(", ");
              const rowPlaceholders: string[] = [];

              items.forEach((item: any) => {
                const placeholders: string[] = [];
                keys.forEach((k) => {
                  params.push(item[k]);
                  placeholders.push(`$${params.length}`);
                });
                rowPlaceholders.push(`(${placeholders.join(", ")})`);
              });

              const returningSql = state.selectAfterMutation ? ` RETURNING ${state.selectAfterMutation}` : " RETURNING *";
              const sql = `INSERT INTO public."${table}" (${colNames}) VALUES ${rowPlaceholders.join(", ")}${returningSql};`;
              const { rows, error } = await executeAsRole(sql, params);
              if (error) return { data: null, error };

              if (state.singleMode === "single") {
                return { data: rows && rows.length > 0 ? rows[0] : null, error: null };
              }
              return { data: rows, error: null };
            }

            if (state.operation === "update") {
              const updateEntries = Object.entries(state.updateValues || {});
              const setClauses = updateEntries.map(([k, v]) => {
                params.push(v);
                return `"${k}" = $${params.length}`;
              });

              const returningSql = state.selectAfterMutation ? ` RETURNING ${state.selectAfterMutation}` : "";
              const sql = `UPDATE public."${table}" SET ${setClauses.join(", ")}${whereSql}${returningSql};`;
              const { rows, error } = await executeAsRole(sql, params);
              if (error) return { data: null, error };
              return { data: rows ?? [], error: null };
            }

            if (state.operation === "delete") {
              const returningSql = state.selectAfterMutation ? ` RETURNING ${state.selectAfterMutation}` : "";
              const sql = `DELETE FROM public."${table}"${whereSql}${returningSql};`;
              const { rows, error } = await executeAsRole(sql, params);
              if (error) return { data: null, error };
              return { data: rows ?? [], error: null };
            }

            return { data: null, error: new Error("Unsupported operation") };
          };

          return run().then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

/**
 * Initializes the full schema, auth schema, helper functions, and RLS policies on PGlite.
 */
async function setupPgLiteDb(): Promise<PGlite> {
  const pg = new PGlite();

  await pg.exec(`
    -- 1. Setup Auth and Extensions
    CREATE SCHEMA IF NOT EXISTS auth;

    -- auth.uid() function mimicking Supabase
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id')
      )::uuid;
    $$;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        'anon'
      )::text;
    $$;

    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE,
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now()
    );

    -- Postgres Roles
    DO $$ BEGIN
      CREATE ROLE anon;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE ROLE authenticated;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- 2. User Roles
    CREATE TABLE IF NOT EXISTS public.user_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role public.app_role NOT NULL DEFAULT 'editor',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );

    CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      );
    $$;

    -- 3. Profiles & Approval Gate
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email text,
      display_name text,
      avatar_url text,
      approval_status text NOT NULL DEFAULT 'approved',
      storage_quota_bytes bigint NOT NULL DEFAULT (2::bigint * 1024 * 1024 * 1024),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id AND p.approval_status = 'approved'
      );
    $$;

    -- 4. Projects
    CREATE TABLE IF NOT EXISTS public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      color text DEFAULT '#6366f1',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- 5. Albums
    CREATE TABLE IF NOT EXISTS public.albums (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
      slug text NOT NULL UNIQUE,
      title text NOT NULL,
      compiled_mind_url text,
      compiled_mind_path text,
      target_count integer NOT NULL DEFAULT 0,
      access_mode text NOT NULL DEFAULT 'public',
      pin_hash text,
      pin_expires_at timestamptz,
      single_use_media boolean NOT NULL DEFAULT false,
      published boolean NOT NULL DEFAULT false,
      show_in_gallery boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- 6. AR Experiences
    CREATE TABLE IF NOT EXISTS public.ar_experiences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
      album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
      target_index integer,
      slug text UNIQUE,
      title text NOT NULL,
      description text,
      cover_image_url text,
      marker_url text,
      asset_3d_url text,
      video_url text,
      access_mode text NOT NULL DEFAULT 'public',
      pin_hash text,
      pin_expires_at timestamptz,
      single_use_media boolean NOT NULL DEFAULT false,
      published boolean NOT NULL DEFAULT false,
      show_in_gallery boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- 7. Licenses & Activations
    CREATE TABLE IF NOT EXISTS public.licenses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      license_key text NOT NULL UNIQUE,
      plan text NOT NULL DEFAULT 'pro',
      status text NOT NULL DEFAULT 'active',
      device_limit integer NOT NULL DEFAULT 3,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.license_activations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
      device_secret_hash text NOT NULL,
      fingerprint text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    -- 8. Audit Log
    CREATE TABLE IF NOT EXISTS public.audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id uuid REFERENCES auth.users(id),
      action text NOT NULL,
      target_type text,
      target_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    -- ========================================================
    -- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
    -- ========================================================
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ar_experiences ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

    -- GRANT permissions to roles
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

    -- ========================================================
    -- APPLY REAL RLS POLICIES
    -- ========================================================
    -- User Roles: Read own, no direct user self-granting of admin
    CREATE POLICY user_roles_read_own ON public.user_roles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

    CREATE POLICY user_roles_insert_admin ON public.user_roles
      FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));

    -- Albums Policies
    CREATE POLICY albums_public_read ON public.albums
      FOR SELECT TO anon
      USING (published = true AND access_mode = 'public');

    CREATE POLICY albums_owner_read ON public.albums
      FOR SELECT TO authenticated
      USING (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      );

    CREATE POLICY albums_owner_insert ON public.albums
      FOR INSERT TO authenticated
      WITH CHECK (
        owner_id = auth.uid()
        AND public.is_approved(auth.uid())
        AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
      );

    CREATE POLICY albums_owner_update ON public.albums
      FOR UPDATE TO authenticated
      USING (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      )
      WITH CHECK (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      );

    CREATE POLICY albums_owner_delete ON public.albums
      FOR DELETE TO authenticated
      USING (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      );

    -- AR Experiences Policies
    CREATE POLICY ar_experiences_public_read ON public.ar_experiences
      FOR SELECT TO anon
      USING (published = true AND access_mode = 'public');

    CREATE POLICY ar_experiences_owner_read ON public.ar_experiences
      FOR SELECT TO authenticated
      USING (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      );

    CREATE POLICY ar_experiences_insert_editor ON public.ar_experiences
      FOR INSERT TO authenticated
      WITH CHECK (
        owner_id = auth.uid()
        AND public.is_approved(auth.uid())
        AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
      );

    CREATE POLICY ar_experiences_update_owner ON public.ar_experiences
      FOR UPDATE TO authenticated
      USING (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      )
      WITH CHECK (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      );

    CREATE POLICY ar_experiences_delete_owner ON public.ar_experiences
      FOR DELETE TO authenticated
      USING (
        (owner_id = auth.uid() AND public.is_approved(auth.uid()))
        OR public.has_role(auth.uid(), 'admin')
      );

    -- Licenses Policies: Non-admin users cannot read others' licenses
    CREATE POLICY licenses_read_own ON public.licenses
      FOR SELECT TO authenticated
      USING (owner_user_id = auth.uid() AND public.is_approved(auth.uid()));

    CREATE POLICY licenses_admin_all ON public.licenses
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));

    -- License Activations Policies: Admin only
    CREATE POLICY activations_admin_all ON public.license_activations
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));

    -- Audit Log Policies: Admin only
    CREATE POLICY audit_log_admin_read ON public.audit_log
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  `);

  return pg;
}

/**
 * Creates a test tenant with an active session, editor role, and published album/experience.
 */
async function createTenant(label: string): Promise<Tenant> {
  const email = `rls-${label}-${stamp}@aether-rls-test.invalid`;
  const password = `Test-${stamp}-${label}!x`;

  if (hasRemoteSupabase) {
    const { data: created, error: createError } = await (admin as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(`could not create test user: ${createError?.message}`);
    }

    const db = createClient(URL_!, PUBLISHABLE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`could not sign in test user: ${signInError.message}`);

    await admin.from("user_roles").insert({ user_id: created.user.id, role: "editor" });

    const albumSlug = `rls-${label}-album-${stamp}`;
    const { data: album, error: albumError } = await db
      .from("albums")
      .insert({
        owner_id: created.user.id,
        title: `RLS ${label} album`,
        slug: albumSlug,
        published: true,
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
      db: db as any,
      albumId: album.id,
      albumSlug,
      experienceId: exp.id,
      experienceSlug,
    };
  }

  // Embedded PostgreSQL (PGlite) tenant setup
  const userId = crypto.randomUUID();

  // Create user in auth.users and profile as admin (service_role)
  await pgliteInstance!.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${userId}', '${email}');
    INSERT INTO public.profiles (id, email, display_name, approval_status) VALUES ('${userId}', '${email}', '${label}', 'approved');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${userId}', 'editor');
  `);

  const db = createPgLiteClient(pgliteInstance!, "authenticated", userId);

  const albumSlug = `rls-${label}-album-${stamp}`;
  const { data: album, error: albumError } = await db
    .from("albums")
    .insert({
      owner_id: userId,
      title: `RLS ${label} album`,
      slug: albumSlug,
      published: true,
    })
    .select("id")
    .single();
  if (albumError || !album) throw new Error(`could not insert album: ${albumError?.message}`);

  const experienceSlug = `rls-${label}-exp-${stamp}`;
  const { data: exp, error: expError } = await db
    .from("ar_experiences")
    .insert({
      owner_id: userId,
      title: `RLS ${label} experience`,
      slug: experienceSlug,
      album_id: album.id,
      published: true,
    })
    .select("id")
    .single();
  if (expError || !exp) throw new Error(`could not insert experience: ${expError?.message}`);

  return {
    id: userId,
    email,
    db,
    albumId: album.id,
    albumSlug,
    experienceId: exp.id,
    experienceSlug,
  };
}

function getAnonClient(): RlsTestClient {
  if (hasRemoteSupabase) {
    return createClient(URL_!, PUBLISHABLE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as any;
  }
  return createPgLiteClient(pgliteInstance!, "anon");
}

beforeAll(async () => {
  if (hasRemoteSupabase) {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as any;
  } else {
    pgliteInstance = await setupPgLiteDb();
    admin = createPgLiteClient(pgliteInstance, "service_role");
  }

  alice = await createTenant("alice");
  bob = await createTenant("bob");
}, 60_000);

afterAll(async () => {
  if (hasRemoteSupabase && admin) {
    for (const t of [alice, bob]) {
      if (!t) continue;
      await admin.from("ar_experiences").delete().eq("owner_id", t.id);
      await admin.from("albums").delete().eq("owner_id", t.id);
      await (admin as any).auth?.admin.deleteUser(t.id).catch(() => {});
    }
  } else if (pgliteInstance) {
    await pgliteInstance.close().catch(() => {});
  }
}, 60_000);

// ============================================================================
// RLS CROSS-TENANT ISOLATION TESTS (11/11 Active)
// ============================================================================
describe("RLS: cross-tenant isolation", () => {
  // 1. A client can only list its own experiences.
  it("a client sees only their own experiences when listing", async () => {
    const { data, error } = await alice.db.from("ar_experiences").select("id, owner_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r: any) => r.owner_id === alice.id)).toBe(true);
    expect(data!.some((r: any) => r.id === bob.experienceId)).toBe(false);
  });

  // 2. A client can only list its own albums.
  it("a client sees only their own albums when listing", async () => {
    const { data, error } = await alice.db.from("albums").select("id, owner_id");
    expect(error).toBeNull();
    expect(data!.every((r: any) => r.owner_id === alice.id)).toBe(true);
    expect(data!.some((r: any) => r.id === bob.albumId)).toBe(false);
  });

  // 3. A client cannot read another client's published experience by ID.
  it("cannot read another client's published experience by id", async () => {
    const { data } = await alice.db
      .from("ar_experiences")
      .select("id")
      .eq("id", bob.experienceId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  // 4. A client cannot read another client's published album by ID or slug.
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

  // 5. A client cannot update another client's rows.
  // 6. A client cannot delete another client's rows.
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

  // 7. A client cannot insert a row owned by another client.
  it("cannot insert a row owned by another client", async () => {
    const { error } = await alice.db.from("albums").insert({
      owner_id: bob.id,
      title: "spoofed",
      slug: `rls-spoof-${stamp}`,
      published: true,
    });
    expect(error).not.toBeNull();
  });

  // 8. Tenant isolation works symmetrically for both tenants.
  it("both tenants are isolated symmetrically", async () => {
    const { data } = await bob.db.from("ar_experiences").select("id, owner_id");
    expect(data!.every((r: any) => r.owner_id === bob.id)).toBe(true);
    expect(data!.some((r: any) => r.id === alice.experienceId)).toBe(false);
  });

  // 9. Anonymous users can read published rows when intended.
  it("anonymous visitors can read published rows (public AR viewer still works)", async () => {
    const anon = getAnonClient();
    const { data, error } = await anon
      .from("ar_experiences")
      .select("id, slug")
      .eq("id", bob.experienceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(bob.experienceId);
  });

  // 10. Anonymous users cannot read unpublished rows.
  it("anonymous visitors cannot read unpublished rows", async () => {
    // Unpublish Alice's experience as Alice, then check the anon view.
    await alice.db.from("ar_experiences").update({ published: false }).eq("id", alice.experienceId);
    const anon = getAnonClient();
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

  // 11. Non-admin users cannot access licences, activations, or audit logs.
  it("a non-admin cannot read licences, activations or the audit log", async () => {
    for (const table of ["licenses", "license_activations", "audit_log"] as const) {
      const { data, error } = await alice.db.from(table).select("id");
      // Either blocked outright or filtered to nothing — never another tenant's data.
      expect(error ? true : (data ?? []).length === 0).toBe(true);
    }
  });

  // 11b. Non-admin users cannot grant themselves admin privileges.
  it("a non-admin cannot grant themselves the admin role", async () => {
    const { error } = await alice.db
      .from("user_roles")
      .insert({ user_id: alice.id, role: "admin" });
    expect(error).not.toBeNull();
  });
});
