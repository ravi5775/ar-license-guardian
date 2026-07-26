-- ============================================================
-- 1. APPROVAL GATE (server-side, data layer)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.approval_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;

-- ============================================================
-- 2. NEW COLUMNS: access mode, gallery toggle, PIN material
-- ============================================================

ALTER TABLE public.ar_experiences
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS show_in_gallery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_encrypted text,
  ADD COLUMN IF NOT EXISTS pin_updated_at timestamptz;

ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS show_in_gallery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_encrypted text,
  ADD COLUMN IF NOT EXISTS pin_updated_at timestamptz;

ALTER TABLE public.ar_experiences DROP CONSTRAINT IF EXISTS ar_experiences_access_mode_check;
ALTER TABLE public.ar_experiences
  ADD CONSTRAINT ar_experiences_access_mode_check CHECK (access_mode IN ('public','restricted'));

ALTER TABLE public.albums DROP CONSTRAINT IF EXISTS albums_access_mode_check;
ALTER TABLE public.albums
  ADD CONSTRAINT albums_access_mode_check CHECK (access_mode IN ('public','restricted'));

-- ============================================================
-- 3. RLS: approval-gated authenticated access
-- ============================================================

-- ---------- ar_experiences ----------
DROP POLICY IF EXISTS ar_experiences_owner_read ON public.ar_experiences;
DROP POLICY IF EXISTS ar_experiences_insert_editor ON public.ar_experiences;
DROP POLICY IF EXISTS ar_experiences_update_owner ON public.ar_experiences;
DROP POLICY IF EXISTS ar_experiences_delete_owner ON public.ar_experiences;
DROP POLICY IF EXISTS ar_experiences_public_read ON public.ar_experiences;

CREATE POLICY ar_experiences_owner_read ON public.ar_experiences
  FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY ar_experiences_insert_editor ON public.ar_experiences
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_approved(auth.uid())
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY ar_experiences_update_owner ON public.ar_experiences
  FOR UPDATE TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY ar_experiences_delete_owner ON public.ar_experiences
  FOR DELETE TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

-- Anonymous visitors may only ever see published, explicitly public rows.
CREATE POLICY ar_experiences_public_read ON public.ar_experiences
  FOR SELECT TO anon
  USING (published = true AND access_mode = 'public');

-- ---------- albums ----------
DROP POLICY IF EXISTS "Anon can read published albums" ON public.albums;
DROP POLICY IF EXISTS "Owners and admins can read albums" ON public.albums;
DROP POLICY IF EXISTS "Owners and admins can insert albums" ON public.albums;
DROP POLICY IF EXISTS "Owners and admins can update albums" ON public.albums;
DROP POLICY IF EXISTS "Owners and admins can delete albums" ON public.albums;

CREATE POLICY albums_public_read ON public.albums
  FOR SELECT TO anon
  USING (published = true AND access_mode = 'public');

CREATE POLICY albums_owner_read ON public.albums
  FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY albums_owner_insert ON public.albums
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_approved(auth.uid())
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY albums_owner_update ON public.albums
  FOR UPDATE TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY albums_owner_delete ON public.albums
  FOR DELETE TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

-- ---------- licenses ----------
DROP POLICY IF EXISTS licenses_read_own ON public.licenses;
CREATE POLICY licenses_read_own ON public.licenses
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() AND public.is_approved(auth.uid()));

-- ---------- marker_tests ----------
DROP POLICY IF EXISTS "Users manage their own marker tests" ON public.marker_tests;
CREATE POLICY marker_tests_own ON public.marker_tests
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_approved(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND public.is_approved(auth.uid()));

-- ============================================================
-- 4. PIN HASHING / VERIFICATION (bcrypt via pgcrypto)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_content_pin(
  _kind text, _id uuid, _pin text, _pin_encrypted text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind = 'album' THEN
    UPDATE public.albums
       SET pin_hash = crypt(_pin, gen_salt('bf', 10)),
           pin_encrypted = _pin_encrypted,
           pin_updated_at = now()
     WHERE id = _id;
  ELSIF _kind = 'experience' THEN
    UPDATE public.ar_experiences
       SET pin_hash = crypt(_pin, gen_salt('bf', 10)),
           pin_encrypted = _pin_encrypted,
           pin_updated_at = now()
     WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'unknown kind';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_content_pin(
  _kind text, _slug text, _pin text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE h text;
BEGIN
  IF _kind = 'album' THEN
    SELECT pin_hash INTO h FROM public.albums WHERE slug = _slug;
  ELSE
    SELECT pin_hash INTO h FROM public.ar_experiences WHERE slug = _slug;
  END IF;
  IF h IS NULL THEN RETURN false; END IF;
  RETURN h = crypt(_pin, h);
END;
$$;

REVOKE ALL ON FUNCTION public.set_content_pin(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_content_pin(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_content_pin(text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_content_pin(text, text, text) TO service_role;

-- ============================================================
-- 5. PIN ATTEMPT THROTTLING + LOCKOUT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pin_failed_attempts (
  id bigserial PRIMARY KEY,
  slug text NOT NULL,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pin_failed_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pin_failed_attempts_id_seq TO service_role;

ALTER TABLE public.pin_failed_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: server-only table (service_role bypasses RLS).

CREATE INDEX IF NOT EXISTS pin_failed_attempts_lookup
  ON public.pin_failed_attempts (slug, ip, created_at DESC);

CREATE OR REPLACE FUNCTION public.pin_attempts_allowed(_slug text, _ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent int; hourly int;
BEGIN
  DELETE FROM public.pin_failed_attempts WHERE created_at < now() - interval '24 hours';

  SELECT count(*) INTO recent FROM public.pin_failed_attempts
   WHERE slug = _slug AND ip = _ip AND created_at > now() - interval '15 minutes';
  IF recent >= 5 THEN RETURN false; END IF;

  SELECT count(*) INTO hourly FROM public.pin_failed_attempts
   WHERE ip = _ip AND created_at > now() - interval '1 hour';
  IF hourly >= 5 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_record_failure(_slug text, _ip text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.pin_failed_attempts (slug, ip) VALUES (_slug, _ip);
$$;

CREATE OR REPLACE FUNCTION public.pin_clear_failures(_slug text, _ip text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.pin_failed_attempts WHERE slug = _slug AND ip = _ip;
$$;

REVOKE ALL ON FUNCTION public.pin_attempts_allowed(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pin_record_failure(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pin_clear_failures(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_attempts_allowed(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_record_failure(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_clear_failures(text, text) TO service_role;