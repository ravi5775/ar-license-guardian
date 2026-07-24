DROP POLICY IF EXISTS ar_experiences_insert_editor ON public.ar_experiences;
CREATE POLICY ar_experiences_insert_editor
ON public.ar_experiences
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('editor'::public.app_role, 'admin'::public.app_role)
  )
);
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;