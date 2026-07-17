
CREATE POLICY "admins manage ar-media"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'ar-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'ar-media' AND public.has_role(auth.uid(), 'admin'));
