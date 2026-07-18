
-- Inline has_role() checks into policies so we can revoke EXECUTE on the SECURITY DEFINER helper.

DROP POLICY IF EXISTS ar_experiences_auth_read ON public.ar_experiences;
CREATE POLICY ar_experiences_auth_read ON public.ar_experiences
  FOR SELECT TO authenticated
  USING (
    published = true
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)
  );

DROP POLICY IF EXISTS ar_experiences_update_owner ON public.ar_experiences;
CREATE POLICY ar_experiences_update_owner ON public.ar_experiences
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)
  );

DROP POLICY IF EXISTS ar_experiences_delete_owner ON public.ar_experiences;
CREATE POLICY ar_experiences_delete_owner ON public.ar_experiences
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)
  );

DROP POLICY IF EXISTS licenses_admin_all ON public.licenses;
CREATE POLICY licenses_admin_all ON public.licenses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

DROP POLICY IF EXISTS activations_admin_all ON public.license_activations;
CREATE POLICY activations_admin_all ON public.license_activations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

DROP POLICY IF EXISTS audit_admin_read ON public.audit_log;
CREATE POLICY audit_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

-- Lock down the helper. Kept for potential server-side (service_role) use.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
