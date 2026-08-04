-- =====================================================================
-- 1. Public exposure: remove anon SELECT on base tables, add safe view
-- ---------------------------------------------------------------------
-- RLS filters rows, not columns, so any anon-readable policy on these
-- tables leaks pin_hash. Public reads go through a narrow view instead.
-- DOWN: recreate albums_public_read / ar_experiences_public_read, re-grant.
DROP POLICY IF EXISTS albums_public_read ON public.albums;
DROP POLICY IF EXISTS ar_experiences_public_read ON public.ar_experiences;
REVOKE ALL ON public.albums FROM anon;
REVOKE ALL ON public.ar_experiences FROM anon;

CREATE OR REPLACE VIEW public.public_experiences
WITH (security_invoker = false) AS
  SELECT slug, title, description, cover_image_url, created_at
    FROM public.ar_experiences
   WHERE published = true
     AND access_mode = 'public'
     AND show_in_gallery = true;

GRANT SELECT ON public.public_experiences TO anon, authenticated;

-- =====================================================================
-- 2. PIN storage: hash-only, with rotation metadata
-- ---------------------------------------------------------------------
-- DOWN: ALTER TABLE ... ADD COLUMN pin_encrypted text; DROP the new cols.
ALTER TABLE public.albums
  DROP COLUMN IF EXISTS pin_encrypted,
  ADD COLUMN IF NOT EXISTS pin_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_expires_at timestamptz;

ALTER TABLE public.ar_experiences
  DROP COLUMN IF EXISTS pin_encrypted,
  ADD COLUMN IF NOT EXISTS pin_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_expires_at timestamptz;

-- ---------------------------------------------------------------------
-- CSPRNG PIN generation with rejection sampling (zero modulo bias).
-- Alphabet: lowercase + digits + safe symbols, minus ambiguous 0 O 1 l I
-- and minus URL-sensitive & = # + % ? / : ; , space.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_content_pin(_length int DEFAULT 6)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789-_.!*';
  n int := length(alphabet);
  limit_byte int;
  out text := '';
  b int;
BEGIN
  -- Largest multiple of n that fits in a byte; anything >= it is rejected.
  limit_byte := (256 / n) * n;
  WHILE length(out) < _length LOOP
    b := get_byte(gen_random_bytes(1), 0);
    IF b < limit_byte THEN
      out := out || substr(alphabet, (b % n) + 1, 1);
    END IF;
  END LOOP;
  RETURN out;
END;
$$;

-- ---------------------------------------------------------------------
-- set_content_pin: writes ONLY the bcrypt hash. No reversible material.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_content_pin(text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.set_content_pin(
  _kind text,
  _id uuid,
  _pin text,
  _ttl_days int DEFAULT 180
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expires timestamptz := now() + make_interval(days => _ttl_days);
BEGIN
  IF _kind = 'album' THEN
    UPDATE public.albums
       SET pin_hash = crypt(_pin, gen_salt('bf', 12)),
           pin_created_at = now(),
           pin_expires_at = expires,
           pin_updated_at = now()
     WHERE id = _id;
  ELSIF _kind = 'experience' THEN
    UPDATE public.ar_experiences
       SET pin_hash = crypt(_pin, gen_salt('bf', 12)),
           pin_created_at = now(),
           pin_expires_at = expires,
           pin_updated_at = now()
     WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'unknown kind';
  END IF;
  RETURN expires;
END;
$$;

-- ---------------------------------------------------------------------
-- verify_content_pin now returns a reason string, not a boolean:
-- 'ok' | 'invalid' | 'pin_expired'
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_content_pin(text, text, text);

CREATE OR REPLACE FUNCTION public.verify_content_pin(
  _kind text,
  _slug text,
  _pin text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE h text; exp timestamptz;
BEGIN
  IF _kind = 'album' THEN
    SELECT pin_hash, pin_expires_at INTO h, exp FROM public.albums WHERE slug = _slug;
  ELSE
    SELECT pin_hash, pin_expires_at INTO h, exp FROM public.ar_experiences WHERE slug = _slug;
  END IF;

  IF h IS NULL THEN RETURN 'invalid'; END IF;
  IF h <> crypt(_pin, h) THEN RETURN 'invalid'; END IF;
  IF exp IS NOT NULL AND exp < now() THEN RETURN 'pin_expired'; END IF;
  RETURN 'ok';
END;
$$;

-- =====================================================================
-- 3. QR auto-unlock tokens — a credential entirely separate from the PIN
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('album', 'experience')),
  content_id uuid NOT NULL,
  slug text NOT NULL,
  -- SHA-256, not bcrypt: the token already carries 192 bits of entropy so a
  -- slow hash buys nothing, and SHA-256 lets us index for O(1) lookup.
  token_hash bytea NOT NULL,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_access_tokens_hash_idx
  ON public.content_access_tokens (token_hash);
CREATE INDEX IF NOT EXISTS content_access_tokens_content_idx
  ON public.content_access_tokens (content_id);

-- No grants at all: reachable only through SECURITY DEFINER functions.
GRANT ALL ON public.content_access_tokens TO service_role;
ALTER TABLE public.content_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.issue_content_access_token(
  _kind text,
  _content_id uuid,
  _ttl_days int DEFAULT 365,
  _label text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  raw text;
  s text;
BEGIN
  IF _kind = 'album' THEN
    SELECT slug INTO s FROM public.albums WHERE id = _content_id;
  ELSE
    SELECT slug INTO s FROM public.ar_experiences WHERE id = _content_id;
  END IF;
  IF s IS NULL THEN RAISE EXCEPTION 'content not found'; END IF;

  -- 24 random bytes -> base64url, returned exactly once and never stored raw.
  raw := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  INSERT INTO public.content_access_tokens
    (kind, content_id, slug, token_hash, label, expires_at, created_by)
  VALUES
    (_kind, _content_id, s, digest(raw, 'sha256'), _label,
     CASE WHEN _ttl_days IS NULL THEN NULL ELSE now() + make_interval(days => _ttl_days) END,
     auth.uid());

  RETURN raw;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_content_access_token(
  _kind text,
  _slug text,
  _token text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.content_access_tokens;
BEGIN
  SELECT * INTO r FROM public.content_access_tokens
   WHERE token_hash = digest(_token, 'sha256')
     AND kind = _kind
     AND slug = _slug;

  IF r.id IS NULL THEN RETURN 'invalid'; END IF;
  IF r.revoked_at IS NOT NULL THEN RETURN 'revoked'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN RETURN 'expired'; END IF;

  UPDATE public.content_access_tokens SET last_used_at = now() WHERE id = r.id;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_content_access_tokens(
  _kind text,
  _content_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n int;
BEGIN
  UPDATE public.content_access_tokens
     SET revoked_at = now()
   WHERE content_id = _content_id AND kind = _kind AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- These are server-only: the app calls them with the service role.
REVOKE ALL ON FUNCTION public.generate_content_pin(int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_content_pin(text, uuid, text, int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_content_pin(text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_content_access_token(text, uuid, int, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_content_access_token(text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_content_access_tokens(text, uuid) FROM anon, authenticated;

-- =====================================================================
-- 4. RESTRICTIVE deny-all on the three internal tables
-- ---------------------------------------------------------------------
-- Why RESTRICTIVE here when the rest of the codebase uses PERMISSIVE:
-- these tables must never be reachable by anon or authenticated under any
-- circumstance; they are only touched by SECURITY DEFINER functions, which
-- bypass RLS via table ownership. A RESTRICTIVE deny-all is AND-ed with
-- every other policy, so it survives someone later adding a permissive
-- policy by accident — a plain PERMISSIVE using(false) would simply be
-- OR-ed open by that new policy.
DROP POLICY IF EXISTS internal_only_no_direct_access ON public.pin_failed_attempts;
CREATE POLICY internal_only_no_direct_access ON public.pin_failed_attempts
  AS RESTRICTIVE FOR ALL USING (false);

DROP POLICY IF EXISTS internal_only_no_direct_access ON public.rate_limit_hits;
CREATE POLICY internal_only_no_direct_access ON public.rate_limit_hits
  AS RESTRICTIVE FOR ALL USING (false);

DROP POLICY IF EXISTS internal_only_no_direct_access ON public.content_access_tokens;
CREATE POLICY internal_only_no_direct_access ON public.content_access_tokens
  AS RESTRICTIVE FOR ALL USING (false);

COMMENT ON TABLE public.content_access_tokens IS
  'QR auto-unlock credentials. SHA-256 hash of a 24-byte CSPRNG token; raw value returned once at issue time. Deliberately unrelated to the content PIN so rotating one does not affect the other.';
