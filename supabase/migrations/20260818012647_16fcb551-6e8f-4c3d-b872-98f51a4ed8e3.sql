CREATE TABLE public.gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  path text NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  approval text,
  deployment_role text NOT NULL DEFAULT 'admin',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX gate_events_created_at_idx ON public.gate_events (created_at DESC);

GRANT SELECT ON public.gate_events TO authenticated;
GRANT ALL ON public.gate_events TO service_role;

ALTER TABLE public.gate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read gate events"
ON public.gate_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));