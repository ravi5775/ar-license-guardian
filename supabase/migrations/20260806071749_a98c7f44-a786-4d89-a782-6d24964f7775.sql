-- 1. Licence device slots + domain allowlist
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS allowed_mobile integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowed_desktop integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS grace_hours integer NOT NULL DEFAULT 72;

ALTER TABLE public.license_activations
  ADD COLUMN IF NOT EXISTS device_class text NOT NULL DEFAULT 'desktop',
  ADD COLUMN IF NOT EXISTS build_id text,
  ADD COLUMN IF NOT EXISTS asset_digest text,
  ADD COLUMN IF NOT EXISTS origin_host text,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

ALTER TABLE public.license_activations
  DROP CONSTRAINT IF EXISTS license_activations_device_class_check;
ALTER TABLE public.license_activations
  ADD CONSTRAINT license_activations_device_class_check
  CHECK (device_class IN ('mobile','desktop'));

-- 2. Signed release manifests (build integrity source of truth)
CREATE TABLE IF NOT EXISTS public.release_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id text NOT NULL UNIQUE,
  asset_digest text NOT NULL,
  signature text NOT NULL,
  branch text NOT NULL DEFAULT 'client-app',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.release_manifests TO authenticated;
GRANT ALL ON public.release_manifests TO service_role;
ALTER TABLE public.release_manifests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "release_manifests_admin_read" ON public.release_manifests;
CREATE POLICY "release_manifests_admin_read" ON public.release_manifests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Violations
CREATE TABLE IF NOT EXISTS public.license_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid REFERENCES public.licenses(id) ON DELETE CASCADE,
  license_key text,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text,
  origin_host text,
  ip_address text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.license_violations TO authenticated;
GRANT ALL ON public.license_violations TO service_role;
ALTER TABLE public.license_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "license_violations_admin_read" ON public.license_violations;
CREATE POLICY "license_violations_admin_read" ON public.license_violations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS license_violations_license_idx
  ON public.license_violations(license_id, created_at DESC);
CREATE INDEX IF NOT EXISTS license_activations_class_idx
  ON public.license_activations(license_id, device_class) WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS update_release_manifests_updated_at ON public.release_manifests;
CREATE TRIGGER update_release_manifests_updated_at
  BEFORE UPDATE ON public.release_manifests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. SECURITY FIX: users must not be able to self-approve.
CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'pending';
    NEW.approval_decided_at := NULL;
    NEW.approved_by := NULL;
    RETURN NEW;
  END IF;

  NEW.approval_status := OLD.approval_status;
  NEW.approval_decided_at := OLD.approval_decided_at;
  NEW.approved_by := OLD.approved_by;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_self_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_self_approval ON public.profiles;
CREATE TRIGGER profiles_prevent_self_approval
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_approval();