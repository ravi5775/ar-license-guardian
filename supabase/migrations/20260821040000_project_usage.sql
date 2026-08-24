-- Migration: Create project_usage table for bandwidth and egress caps
CREATE TABLE IF NOT EXISTS public.project_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  egress_bytes bigint NOT NULL DEFAULT 0,
  egress_cap_bytes bigint NOT NULL DEFAULT 107374182400, -- 100 GB default monthly cap
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

COMMENT ON TABLE public.project_usage IS 'Monthly egress bandwidth accounting and quota enforcement per project.';
