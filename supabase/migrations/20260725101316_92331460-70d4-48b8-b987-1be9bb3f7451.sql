DROP POLICY IF EXISTS ar_experiences_insert_editor ON public.ar_experiences;
CREATE POLICY ar_experiences_insert_editor ON public.ar_experiences
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.approval_status = 'approved')
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = auth.uid()
                   AND ur.role IN ('editor', 'admin'))
  );

DROP FUNCTION IF EXISTS public.is_approved(uuid);

REVOKE EXECUTE ON FUNCTION public.tg_apply_approval() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;