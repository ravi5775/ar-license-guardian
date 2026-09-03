-- AETHER AR multi-tenant architecture
-- This migration extends the existing single-tenant schema without renaming
-- application-facing columns or changing the existing app_role enum.

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  domain text UNIQUE,
  cloudflare_project_name text,
  supabase_project_ref text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tenants (slug, display_name)
VALUES ('legacy', 'Legacy tenant')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.ar_experiences
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.design_catalogs
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.license_activations
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.release_manifests
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Backfill existing installations before enforcing the boundary.
DO $$
DECLARE
  legacy_tenant uuid;
BEGIN
  SELECT id INTO legacy_tenant FROM public.tenants WHERE slug = 'legacy';

  UPDATE public.profiles SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.user_roles SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.projects SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.albums SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.ar_experiences SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.design_catalogs SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.catalog_items SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.scan_events SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.licenses SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.license_activations SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.release_manifests SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
  UPDATE public.audit_log SET tenant_id = legacy_tenant WHERE tenant_id IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT t.id FROM public.tenants t WHERE t.slug = 'legacy')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.tenant_id = p_tenant_id
      AND ur.role = p_role
  );
$$;

-- Existing signup flows do not provide tenant_id; the secure default derives it
-- from the authenticated profile and falls back to the migration's legacy tenant.
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.projects ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.albums ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.ar_experiences ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.design_catalogs ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.catalog_items ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.scan_events ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.licenses ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.license_activations ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.release_manifests ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.audit_log ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.albums ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.ar_experiences ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.design_catalogs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.catalog_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.scan_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.licenses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.license_activations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.release_manifests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN tenant_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('video', 'glb', 'usdz', 'image', 'marker')),
  r2_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id),
  target_type text NOT NULL CHECK (target_type IN ('experience', 'album', 'catalog_item')),
  target_id uuid NOT NULL,
  short_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.album_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id),
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  target_index integer NOT NULL CHECK (target_index >= 0),
  media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (album_id, target_index)
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_member_read ON public.tenants;
CREATE POLICY tenants_member_read ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

DROP POLICY IF EXISTS media_assets_owner_all ON public.media_assets;
CREATE POLICY media_assets_owner_all ON public.media_assets
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND owner_id = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND owner_id = auth.uid());

DROP POLICY IF EXISTS qr_codes_public_active_target ON public.qr_codes;
CREATE POLICY qr_codes_public_active_target ON public.qr_codes
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = qr_codes.tenant_id AND t.status = 'active'
    )
    AND (
      (target_type = 'experience' AND EXISTS (
        SELECT 1 FROM public.ar_experiences e
        WHERE e.id = target_id AND e.tenant_id = qr_codes.tenant_id AND e.published = true
      ))
      OR (target_type = 'album' AND EXISTS (
        SELECT 1 FROM public.albums a
        WHERE a.id = target_id AND a.tenant_id = qr_codes.tenant_id AND a.published = true
      ))
      OR (target_type = 'catalog_item' AND EXISTS (
        SELECT 1 FROM public.catalog_items ci
        WHERE ci.id = target_id AND ci.tenant_id = qr_codes.tenant_id AND ci.is_active = true
      ))
    )
  );

DROP POLICY IF EXISTS qr_codes_owner_all ON public.qr_codes;
CREATE POLICY qr_codes_owner_all ON public.qr_codes
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS album_items_owner_all ON public.album_items;
CREATE POLICY album_items_owner_all ON public.album_items
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.albums a
      WHERE a.id = album_items.album_id
        AND a.tenant_id = album_items.tenant_id
        AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.albums a
      WHERE a.id = album_items.album_id
        AND a.tenant_id = album_items.tenant_id
        AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Replace legacy permissive policies with tenant-scoped policies. Policies are
-- dropped dynamically because earlier migrations used different policy names.
DO $$
DECLARE
  table_name text;
  policy_record record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'user_roles', 'projects', 'albums', 'ar_experiences',
    'design_catalogs', 'catalog_items', 'scan_events', 'licenses',
    'license_activations', 'release_manifests', 'audit_log'
  ] LOOP
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY profiles_select_tenant ON public.profiles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ));
CREATE POLICY profiles_update_own_tenant ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND tenant_id = public.current_tenant_id())
  WITH CHECK (id = auth.uid() AND tenant_id = public.current_tenant_id());

CREATE POLICY user_roles_select_own_tenant ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.current_tenant_id());

CREATE POLICY projects_owner_tenant ON public.projects
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ));

CREATE POLICY experiences_public_active ON public.ar_experiences
  FOR SELECT TO anon
  USING (published = true AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = ar_experiences.tenant_id AND t.status = 'active'
  ));
CREATE POLICY experiences_owner_tenant ON public.ar_experiences
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ));

CREATE POLICY albums_public_active ON public.albums
  FOR SELECT TO anon
  USING (published = true AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = albums.tenant_id AND t.status = 'active'
  ));
CREATE POLICY albums_owner_tenant ON public.albums
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ));

CREATE POLICY design_catalogs_public_active ON public.design_catalogs
  FOR SELECT TO anon
  USING (is_active = true AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = design_catalogs.tenant_id AND t.status = 'active'
  ));
CREATE POLICY design_catalogs_owner_tenant ON public.design_catalogs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ));

CREATE POLICY catalog_items_public_active ON public.catalog_items
  FOR SELECT TO anon
  USING (is_active = true AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = catalog_items.tenant_id AND t.status = 'active'
  ));
CREATE POLICY catalog_items_owner_tenant ON public.catalog_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (
    owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  ));

CREATE POLICY scan_events_insert_active ON public.scan_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY scan_events_select_admin ON public.scan_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- License state and release manifests remain service-role-only. No policies
-- are intentionally created for authenticated or anonymous clients.
CREATE POLICY audit_log_insert_authenticated ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND actor_id = auth.uid());
CREATE POLICY audit_log_select_admin ON public.audit_log
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE INDEX IF NOT EXISTS tenants_status_idx
  ON public.tenants (status);
CREATE INDEX IF NOT EXISTS profiles_tenant_idx
  ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS user_roles_tenant_idx
  ON public.user_roles (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS experiences_tenant_idx
  ON public.ar_experiences (tenant_id, published);
CREATE INDEX IF NOT EXISTS albums_tenant_idx
  ON public.albums (tenant_id, published);
CREATE INDEX IF NOT EXISTS catalog_items_tenant_idx
  ON public.catalog_items (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS media_assets_tenant_idx
  ON public.media_assets (tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS qr_codes_target_idx
  ON public.qr_codes (tenant_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS album_items_album_idx
  ON public.album_items (tenant_id, album_id, target_index);
CREATE INDEX IF NOT EXISTS scan_events_tenant_created_idx
  ON public.scan_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_touch_updated_at ON public.tenants;
CREATE TRIGGER tenants_touch_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object('row', to_jsonb(COALESCE(NEW, OLD)))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS albums_audit_event ON public.albums;
CREATE TRIGGER albums_audit_event
  AFTER INSERT OR UPDATE OR DELETE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS experiences_audit_event ON public.ar_experiences;
CREATE TRIGGER experiences_audit_event
  AFTER INSERT OR UPDATE OR DELETE ON public.ar_experiences
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS catalog_items_audit_event ON public.catalog_items;
CREATE TRIGGER catalog_items_audit_event
  AFTER INSERT OR UPDATE OR DELETE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
