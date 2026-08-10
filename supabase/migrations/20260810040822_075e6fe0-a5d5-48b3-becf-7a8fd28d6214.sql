-- 1. Device identity: server-minted secret, release cooldown, capability tier
ALTER TABLE public.license_activations
  ADD COLUMN IF NOT EXISTS device_secret_hash text,
  ADD COLUMN IF NOT EXISTS release_after timestamptz,
  ADD COLUMN IF NOT EXISTS capability_tier text,
  ADD COLUMN IF NOT EXISTS label text;

-- Retire duplicate live devices of the same class (keep the most recent).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY license_id, device_class
           ORDER BY COALESCE(last_seen_at, activated_at) DESC, activated_at DESC
         ) AS rn
  FROM public.license_activations
  WHERE revoked_at IS NULL
)
UPDATE public.license_activations a
   SET revoked_at = now()
  FROM ranked r
 WHERE a.id = r.id AND r.rn > 1;

-- One live device per (licence, class), enforced transactionally by the DB.
CREATE UNIQUE INDEX IF NOT EXISTS license_activations_one_live_per_class
  ON public.license_activations (license_id, device_class)
  WHERE revoked_at IS NULL;

-- 2. Violations: severity + notification dedup + resolution
ALTER TABLE public.license_violations
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

CREATE INDEX IF NOT EXISTS license_violations_dedup
  ON public.license_violations (license_id, kind, notified_at DESC);