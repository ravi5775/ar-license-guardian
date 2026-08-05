-- ============================================================
-- Item 3: one-time-use signed media  +  Item 8: storage quotas
-- Every block has a DOWN: comment so this is reversible by hand.
-- ============================================================

-- ---------- opt-in switch, per content item ----------
-- Default false: normal gallery viewing keeps the 15-minute reusable URL,
-- because a one-time URL breaks ordinary browser behaviour (reload, scrub,
-- range requests). Only sensitive content should opt in.
ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS single_use_media boolean NOT NULL DEFAULT false;
ALTER TABLE public.ar_experiences
  ADD COLUMN IF NOT EXISTS single_use_media boolean NOT NULL DEFAULT false;
-- DOWN: ALTER TABLE public.albums DROP COLUMN single_use_media;
--       ALTER TABLE public.ar_experiences DROP COLUMN single_use_media;

-- ---------- one-time media nonces ----------
CREATE TABLE IF NOT EXISTS public.media_access_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash text NOT NULL UNIQUE,
  storage_path text NOT NULL,
  kind text NOT NULL,
  content_slug text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_access_nonces_expires_idx
  ON public.media_access_nonces (expires_at);

GRANT ALL ON public.media_access_nonces TO service_role;
ALTER TABLE public.media_access_nonces ENABLE ROW LEVEL SECURITY;
-- RESTRICTIVE (AND-ed with every other policy) so that a future permissive
-- policy added by mistake still cannot open this table to clients. Only the
-- service role, which bypasses RLS entirely, may touch it.
DROP POLICY IF EXISTS media_access_nonces_deny_all ON public.media_access_nonces;
CREATE POLICY media_access_nonces_deny_all ON public.media_access_nonces
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
-- DOWN: DROP TABLE public.media_access_nonces;

-- ---------- media signing audit log ----------
CREATE TABLE IF NOT EXISTS public.media_signing_events (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  content_slug text NOT NULL,
  storage_path text NOT NULL,
  single_use boolean NOT NULL DEFAULT false,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_signing_events_created_idx
  ON public.media_signing_events (created_at DESC);

GRANT SELECT ON public.media_signing_events TO authenticated;
GRANT ALL ON public.media_signing_events TO service_role;
ALTER TABLE public.media_signing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_signing_events_admin_read ON public.media_signing_events;
CREATE POLICY media_signing_events_admin_read ON public.media_signing_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Writes are service-role only; no INSERT policy on purpose.
-- DOWN: DROP TABLE public.media_signing_events;

-- ---------- per-object storage accounting ----------
CREATE TABLE IF NOT EXISTS public.media_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_objects_owner_idx ON public.media_objects (owner_id);

GRANT SELECT ON public.media_objects TO authenticated;
GRANT ALL ON public.media_objects TO service_role;
ALTER TABLE public.media_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_objects_owner_read ON public.media_objects;
CREATE POLICY media_objects_owner_read ON public.media_objects
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Writes are service-role only: a client must never be able to under-report
-- its own usage.
-- DOWN: DROP TABLE public.media_objects;

-- ---------- quota on the profile ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint NOT NULL
    DEFAULT (2::bigint * 1024 * 1024 * 1024),  -- 2 GB
  ADD COLUMN IF NOT EXISTS storage_alert_sent_at timestamptz;
-- DOWN: ALTER TABLE public.profiles DROP COLUMN storage_quota_bytes,
--         DROP COLUMN storage_alert_sent_at;

-- ---------- usage helper ----------
CREATE OR REPLACE FUNCTION public.storage_usage(_owner uuid)
RETURNS TABLE (used_bytes bigint, quota_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT SUM(bytes) FROM public.media_objects WHERE owner_id = _owner), 0)::bigint,
    COALESCE((SELECT storage_quota_bytes FROM public.profiles WHERE id = _owner),
             2::bigint * 1024 * 1024 * 1024)::bigint;
$$;
REVOKE ALL ON FUNCTION public.storage_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage(uuid) TO authenticated, service_role;
-- DOWN: DROP FUNCTION public.storage_usage(uuid);

-- ---------- nonce issue / consume ----------
CREATE OR REPLACE FUNCTION public.consume_media_nonce(_nonce_hash text)
RETURNS TABLE (storage_path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.media_access_nonces
   WHERE expires_at < now() - interval '1 day';

  RETURN QUERY
  UPDATE public.media_access_nonces n
     SET consumed_at = now()
   WHERE n.nonce_hash = _nonce_hash
     AND n.consumed_at IS NULL
     AND n.expires_at > now()
  RETURNING n.storage_path;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_media_nonce(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_media_nonce(text) TO service_role;
-- DOWN: DROP FUNCTION public.consume_media_nonce(text);