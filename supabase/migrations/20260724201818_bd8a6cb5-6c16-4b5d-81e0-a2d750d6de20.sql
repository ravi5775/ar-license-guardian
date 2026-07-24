
DROP POLICY "Anyone can record scan events" ON public.scan_events;

CREATE POLICY "Scan events only for published albums"
  ON public.scan_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums a
      WHERE a.id = scan_events.album_id AND a.published = true
    )
  );
