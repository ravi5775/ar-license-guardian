-- 1. Projects (client-facing folders)
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_owner_read ON public.projects;
CREATE POLICY projects_owner_read ON public.projects FOR SELECT TO authenticated
  USING (((owner_id = auth.uid()) AND public.is_approved(auth.uid())) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS projects_owner_insert ON public.projects;
CREATE POLICY projects_owner_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS projects_owner_update ON public.projects;
CREATE POLICY projects_owner_update ON public.projects FOR UPDATE TO authenticated
  USING (((owner_id = auth.uid()) AND public.is_approved(auth.uid())) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (((owner_id = auth.uid()) AND public.is_approved(auth.uid())) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS projects_owner_delete ON public.projects;
CREATE POLICY projects_owner_delete ON public.projects FOR DELETE TO authenticated
  USING (((owner_id = auth.uid()) AND public.is_approved(auth.uid())) OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.ar_experiences ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS albums_project_id_idx ON public.albums(project_id);
CREATE INDEX IF NOT EXISTS ar_experiences_project_id_idx ON public.ar_experiences(project_id);

-- 2. Restore Data API privileges (currently missing on every table).
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT ALL ON public.albums TO service_role;
-- Public viewers: explicit safe column list, never pin_hash / pin_encrypted.
GRANT SELECT (id, slug, title, owner_id, compiled_mind_path, compiled_mind_url,
  target_count, published, created_at, updated_at, access_mode, show_in_gallery,
  pin_updated_at, project_id) ON public.albums TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_experiences TO authenticated;
GRANT ALL ON public.ar_experiences TO service_role;
GRANT SELECT (id, owner_id, slug, title, description, cover_image_url, marker_url,
  media_url, media_type, autoplay, loop_playback, published, view_count,
  created_at, updated_at, marker_path, marker_mind_path, media_path, album_id,
  target_index, access_mode, show_in_gallery, pin_updated_at, project_id)
  ON public.ar_experiences TO anon;

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.audit_log_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_activations TO authenticated;
GRANT ALL ON public.license_activations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marker_tests TO authenticated;
GRANT ALL ON public.marker_tests TO service_role;

GRANT SELECT, INSERT ON public.scan_events TO authenticated;
GRANT INSERT ON public.scan_events TO anon;
GRANT ALL ON public.scan_events TO service_role;

GRANT ALL ON public.rate_limit_hits TO service_role;
GRANT ALL ON SEQUENCE public.rate_limit_hits_id_seq TO service_role;
GRANT ALL ON public.pin_failed_attempts TO service_role;
GRANT ALL ON SEQUENCE public.pin_failed_attempts_id_seq TO service_role;

-- 3. RLS policies call has_role/is_approved; the roles must be able to execute them.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, anon;
