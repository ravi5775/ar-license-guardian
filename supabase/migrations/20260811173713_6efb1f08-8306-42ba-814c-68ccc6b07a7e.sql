CREATE OR REPLACE FUNCTION public.storage_usage(_owner uuid)
RETURNS TABLE(used_bytes bigint, quota_bytes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE((SELECT SUM(bytes) FROM public.media_objects WHERE owner_id = _owner), 0)::bigint,
    COALESCE((SELECT storage_quota_bytes FROM public.profiles WHERE id = _owner),
             2::bigint * 1024 * 1024 * 1024)::bigint
  WHERE _owner = auth.uid() OR public.has_role(auth.uid(), 'admin');
$function$;

REVOKE ALL ON FUNCTION public.storage_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage(uuid) TO authenticated, service_role;