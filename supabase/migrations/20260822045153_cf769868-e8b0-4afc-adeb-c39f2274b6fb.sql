CREATE OR REPLACE FUNCTION public.pin_attempts_allowed(_slug text, _ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  recent int;
  hourly int;
BEGIN
  SELECT count(*) INTO recent FROM public.pin_failed_attempts
   WHERE slug = _slug AND ip = _ip AND created_at > now() - interval '15 minutes';
  IF recent >= 5 THEN RETURN false; END IF;

  SELECT count(*) INTO hourly FROM public.pin_failed_attempts
   WHERE ip = _ip AND created_at > now() - interval '1 hour';
  IF hourly >= 25 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_cleanup_old_failures()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.pin_failed_attempts 
   WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_cleanup_old_failures() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_cleanup_old_failures() TO service_role;

ALTER TABLE public.licenses ALTER COLUMN grace_hours SET DEFAULT 24;
UPDATE public.licenses SET grace_hours = 24 WHERE grace_hours = 72;
COMMENT ON COLUMN public.licenses.grace_hours IS 'Offline grace period in hours (default 24). Admin-configurable per-licence for special events.';

ALTER TABLE public.release_manifests
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS files jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mismatch_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_release_manifests_customer_build
  ON public.release_manifests (customer_id, build_id);

CREATE TABLE IF NOT EXISTS public.revoked_builds (
  build_id text PRIMARY KEY,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revoked_builds TO authenticated;
GRANT ALL ON public.revoked_builds TO service_role;
ALTER TABLE public.revoked_builds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "revoked_builds_admin_all" ON public.revoked_builds;
CREATE POLICY "revoked_builds_admin_all" ON public.revoked_builds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.project_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  egress_bytes bigint NOT NULL DEFAULT 0,
  egress_cap_bytes bigint NOT NULL DEFAULT 107374182400,
  request_count bigint NOT NULL DEFAULT 0,
  warning_80_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_usage_project_month_unique UNIQUE(project_id, month_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_usage TO authenticated;
GRANT ALL ON public.project_usage TO service_role;
ALTER TABLE public.project_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_usage_admin_all" ON public.project_usage;
CREATE POLICY "project_usage_admin_all" ON public.project_usage
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "project_usage_read_own" ON public.project_usage;
CREATE POLICY "project_usage_read_own" ON public.project_usage
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_usage.project_id AND p.owner_id = auth.uid()
  ));