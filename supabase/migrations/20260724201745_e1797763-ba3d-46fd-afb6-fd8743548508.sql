
-- Analytics events from the public album/AR viewer
CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  experience_id uuid REFERENCES public.ar_experiences(id) ON DELETE CASCADE,
  target_index integer,
  event_type text NOT NULL CHECK (event_type IN ('album_open','target_found','playback_start','playback_complete','recognition_timeout')),
  session_id text NOT NULL,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scan_events_album_idx ON public.scan_events(album_id, created_at DESC);

GRANT SELECT, INSERT ON public.scan_events TO authenticated;
GRANT INSERT ON public.scan_events TO anon;
GRANT ALL ON public.scan_events TO service_role;

ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record scan events"
  ON public.scan_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owners and admins can read scan events"
  ON public.scan_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.albums a WHERE a.id = scan_events.album_id AND a.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- Guided real-world marker accuracy calibration runs
CREATE TABLE public.marker_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  album_id uuid REFERENCES public.albums(id) ON DELETE SET NULL,
  experience_id uuid REFERENCES public.ar_experiences(id) ON DELETE SET NULL,
  marker_label text NOT NULL,
  step_key text NOT NULL,
  lighting text NOT NULL,
  distance_cm integer,
  angle_deg integer,
  device text,
  outcome text NOT NULL CHECK (outcome IN ('success','partial','fail')),
  time_to_detect_ms integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marker_tests_owner_idx ON public.marker_tests(owner_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marker_tests TO authenticated;
GRANT ALL ON public.marker_tests TO service_role;

ALTER TABLE public.marker_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own marker tests"
  ON public.marker_tests FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can read all marker tests"
  ON public.marker_tests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE TRIGGER marker_tests_set_updated_at
  BEFORE UPDATE ON public.marker_tests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
