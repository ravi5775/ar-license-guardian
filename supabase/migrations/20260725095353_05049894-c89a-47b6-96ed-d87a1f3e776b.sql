-- 1. Stop cross-account data leakage: signed-in users must only read their own rows.
DROP POLICY IF EXISTS "ar_experiences_auth_read" ON public.ar_experiences;
CREATE POLICY "ar_experiences_owner_read" ON public.ar_experiences
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

DROP POLICY IF EXISTS "Public can read published albums" ON public.albums;
CREATE POLICY "Anon can read published albums" ON public.albums
  FOR SELECT TO anon
  USING (published = true);

-- 2. Restore the profile/role bootstrap trigger for new signups (no admin grant).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block account creation because of profile bootstrap problems.
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();