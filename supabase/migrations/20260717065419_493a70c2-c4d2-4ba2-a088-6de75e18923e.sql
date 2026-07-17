
-- Remove auto-admin bootstrap: new signups always get 'viewer'. Admins must be provisioned explicitly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$function$;

-- Lock down SECURITY DEFINER functions that must not be callable by API roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_and_record_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
-- has_role is invoked by RLS policies as authenticated; keep EXECUTE for authenticated only, revoke from anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Storage policies for ar-media: keep admin-only management. Uploads are brokered by a server function
-- that mints signed URLs (bypassing RLS), and public reads are served through server-signed URLs from
-- getPublicExperience. No owner-scoped policies are required because non-admins never hold write
-- credentials for this bucket, and the bucket is private by design.
-- (No changes needed; documented here as an explicit decision.)
