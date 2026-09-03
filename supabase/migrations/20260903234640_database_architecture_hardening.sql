-- Database Architecture 03 hardening.
-- This migration adds the canonical append-only and licensing tables while
-- retaining legacy names used by the current application.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('video', 'glb', 'usdz', 'thumb', 'marker')),
  r2_key text NOT NULL UNIQUE,
  bytes bigint CHECK (bytes IS NULL OR bytes >= 0),
  sha256 text,
  mime text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  marker_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  media_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.license_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  grace_until timestamptz,
  last_heartbeat timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Bring the existing scan stream to the canonical privacy-safe shape.
ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS qr_code uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ua_hash text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE public.album_items
  ADD COLUMN IF NOT EXISTS experience_id uuid REFERENCES public.ar_experiences(id) ON DELETE SET NULL;

UPDATE public.scan_events
SET occurred_at = created_at
WHERE occurred_at IS NULL;

ALTER TABLE public.scan_events
  ALTER COLUMN occurred_at SET DEFAULT now(),
  ALTER COLUMN occurred_at SET NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
GRANT SELECT ON public.assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiences TO authenticated;
GRANT ALL ON public.experiences TO service_role;
GRANT SELECT ON public.experiences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogs TO authenticated;
GRANT ALL ON public.catalogs TO service_role;
GRANT SELECT ON public.catalogs TO anon;
GRANT ALL ON public.license_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_counters TO service_role;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
REVOKE UPDATE, DELETE ON public.audit_events FROM authenticated;
REVOKE UPDATE, DELETE ON public.scan_events FROM authenticated, anon;
GRANT SELECT, INSERT ON public.scan_events TO authenticated;
GRANT INSERT ON public.scan_events TO anon;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_tenant_read ON public.assets
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY assets_tenant_write ON public.assets
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY experiences_tenant_read ON public.experiences
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY experiences_public_published ON public.experiences
  FOR SELECT TO anon
  USING (status = 'published' AND published_at IS NOT NULL);
CREATE POLICY experiences_editors_write ON public.experiences
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'editor')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY catalogs_tenant_read ON public.catalogs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY catalogs_public_published ON public.catalogs
  FOR SELECT TO anon
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE status = 'active')
    AND status = 'published');
CREATE POLICY catalogs_editors_write ON public.catalogs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'editor')
  ))
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND actor_id = auth.uid());
CREATE POLICY audit_events_admin_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (public.has_tenant_role(auth.uid(), tenant_id, 'owner')
      OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')));

CREATE INDEX IF NOT EXISTS experiences_tenant_status_idx
  ON public.experiences (tenant_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS assets_tenant_kind_idx
  ON public.assets (tenant_id, kind);
CREATE INDEX IF NOT EXISTS catalogs_tenant_idx
  ON public.catalogs (tenant_id);
CREATE INDEX IF NOT EXISTS scan_events_tenant_occurred_idx
  ON public.scan_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_occurred_idx
  ON public.audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON public.audit_events (entity, entity_id);

CREATE OR REPLACE FUNCTION public.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON public.audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();
DROP TRIGGER IF EXISTS scan_events_append_only ON public.scan_events;
CREATE TRIGGER scan_events_append_only
  BEFORE UPDATE OR DELETE ON public.scan_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION public.write_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_events (
    tenant_id, actor_id, action, entity, entity_id, before, after
  )
  VALUES (
    COALESCE(OLD.tenant_id, NEW.tenant_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(OLD.id, NEW.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.write_license_state_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_events (
    tenant_id, actor_id, action, entity, entity_id, before, after
  )
  VALUES (
    COALESCE(OLD.tenant_id, NEW.tenant_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(OLD.tenant_id, NEW.tenant_id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.write_license_state_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS experiences_write_audit ON public.experiences;
CREATE TRIGGER experiences_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_event();
DROP TRIGGER IF EXISTS catalogs_write_audit ON public.catalogs;
CREATE TRIGGER catalogs_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.catalogs
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_event();
DROP TRIGGER IF EXISTS assets_write_audit ON public.assets;
CREATE TRIGGER assets_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_event();

-- Apply the same transaction-bound audit behavior to existing business tables
-- that were present before the canonical architecture migration.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects', 'albums', 'ar_experiences', 'design_catalogs',
    'catalog_items', 'media_assets', 'qr_codes', 'album_items'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_write_audit', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.write_audit_event()',
      table_name || '_write_audit',
      table_name
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS license_state_write_audit ON public.license_state;
CREATE TRIGGER license_state_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.license_state
  FOR EACH ROW EXECUTE FUNCTION public.write_license_state_audit_event();

CREATE OR REPLACE FUNCTION public.touch_architecture_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiences_touch_updated_at ON public.experiences;
CREATE TRIGGER experiences_touch_updated_at
  BEFORE UPDATE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.touch_architecture_updated_at();
DROP TRIGGER IF EXISTS catalogs_touch_updated_at ON public.catalogs;
CREATE TRIGGER catalogs_touch_updated_at
  BEFORE UPDATE ON public.catalogs
  FOR EACH ROW EXECUTE FUNCTION public.touch_architecture_updated_at();
