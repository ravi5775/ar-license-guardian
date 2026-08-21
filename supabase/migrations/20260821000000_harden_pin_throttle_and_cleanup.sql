-- Migration: 20260821000000_harden_pin_throttle_and_cleanup.sql
-- 1. Redesign pin_attempts_allowed to eliminate inline DELETE from the verification hot-path.
-- 2. Differentiate 15-minute per-slug throttle (5 attempts) from hourly global IP throttle (25 attempts).
-- 3. Provide dedicated batch maintenance function pin_cleanup_old_failures().

CREATE OR REPLACE FUNCTION public.pin_attempts_allowed(_slug text, _ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  recent int;
  hourly int;
BEGIN
  -- Per-slug brute force limit: 5 failures per 15 minutes for specific slug+IP
  SELECT count(*) INTO recent FROM public.pin_failed_attempts
   WHERE slug = _slug AND ip = _ip AND created_at > now() - interval '15 minutes';
  IF recent >= 5 THEN RETURN false; END IF;

  -- Platform-wide IP enumeration limit: 25 failures per hour across all slugs
  -- This stops multi-slug automated probing while not blocking shared NAT/VPN users
  SELECT count(*) INTO hourly FROM public.pin_failed_attempts
   WHERE ip = _ip AND created_at > now() - interval '1 hour';
  IF hourly >= 25 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

-- Dedicated maintenance function: runs out-of-band via pg_cron or background task
CREATE OR REPLACE FUNCTION public.pin_cleanup_old_failures()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.pin_failed_attempts 
   WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_cleanup_old_failures() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_cleanup_old_failures() TO service_role;
