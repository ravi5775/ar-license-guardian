
-- 1. Storage columns for AR experiences
ALTER TABLE public.ar_experiences
  ADD COLUMN IF NOT EXISTS marker_path text,
  ADD COLUMN IF NOT EXISTS marker_mind_path text,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image','video')) DEFAULT 'video';

-- 2. First-admin bootstrap: replace handle_new_user so the very first signup becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'viewer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

-- Ensure trigger exists (may already exist under Lovable-managed auth)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Rate limit primitive (ad-hoc; no framework support)
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  key text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_lookup
  ON public.rate_limit_hits (bucket, key, hit_at DESC);

GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role writes/reads via SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.check_and_record_hit(
  _bucket text,
  _key text,
  _window_seconds int,
  _max int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hit_count int;
BEGIN
  DELETE FROM public.rate_limit_hits
    WHERE hit_at < now() - (make_interval(secs => _window_seconds * 10));

  SELECT COUNT(*) INTO hit_count
    FROM public.rate_limit_hits
    WHERE bucket = _bucket
      AND key = _key
      AND hit_at > now() - make_interval(secs => _window_seconds);

  IF hit_count >= _max THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_hits (bucket, key) VALUES (_bucket, _key);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_record_hit(text, text, int, int) TO anon, authenticated, service_role;
