-- Constrain what anonymous/authenticated visitors may write into analytics.
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_session_id_len CHECK (char_length(session_id) BETWEEN 8 AND 64),
  ADD CONSTRAINT scan_events_duration_range CHECK (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms <= 3600000)),
  ADD CONSTRAINT scan_events_target_index_range CHECK (target_index IS NULL OR (target_index >= 0 AND target_index < 100)),
  ADD CONSTRAINT scan_events_subject_present CHECK (album_id IS NOT NULL OR experience_id IS NOT NULL);

DROP POLICY IF EXISTS "Scan events only for published albums" ON public.scan_events;
CREATE POLICY "Scan events only for published content" ON public.scan_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (
      album_id IS NULL
      OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id = scan_events.album_id AND a.published = true)
    )
    AND (
      experience_id IS NULL
      OR EXISTS (SELECT 1 FROM public.ar_experiences e WHERE e.id = scan_events.experience_id AND e.published = true)
    )
    AND (
      experience_id IS NULL
      OR album_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ar_experiences e
        WHERE e.id = scan_events.experience_id AND e.album_id = scan_events.album_id
      )
    )
  );

-- Owners should also see analytics for their standalone experiences.
DROP POLICY IF EXISTS "Owners and admins can read scan events" ON public.scan_events;
CREATE POLICY "Owners and admins can read scan events" ON public.scan_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.albums a WHERE a.id = scan_events.album_id AND a.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.ar_experiences e WHERE e.id = scan_events.experience_id AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );