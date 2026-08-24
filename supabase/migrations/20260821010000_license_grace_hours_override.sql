-- Migration: Update default grace_hours to 24h and add audit comment/index
-- Per-licence override allowed for custom event extensions by admin only.

ALTER TABLE public.licenses
  ALTER COLUMN grace_hours SET DEFAULT 24;

-- Update any existing records currently sitting at 72 to the hardened 24h default
UPDATE public.licenses
  SET grace_hours = 24
  WHERE grace_hours = 72;

COMMENT ON COLUMN public.licenses.grace_hours IS 'Offline grace period in hours (default 24). Admin-configurable per-licence for special events.';
