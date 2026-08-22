-- Migration: Add revoked_builds kill-switch table with RLS and admin policy
CREATE TABLE IF NOT EXISTS public.revoked_builds (
  build_id text PRIMARY KEY,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

COMMENT ON TABLE public.revoked_builds IS 'Server-side kill switch table for revoking compromised or pirated client builds instantly.';
