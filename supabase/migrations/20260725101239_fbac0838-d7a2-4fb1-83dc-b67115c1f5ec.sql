-- 1) Approval state on profiles
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Existing accounts keep working.
UPDATE public.profiles p
   SET approval_status = 'approved',
       approval_decided_at = COALESCE(p.approval_decided_at, now())
 WHERE p.approval_status = 'pending';

UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE u.id = p.id AND p.email IS NULL;

-- 2) Licence ownership + auto-issued flag
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS auto_issued boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS licenses_auto_owner_unique
  ON public.licenses (owner_user_id) WHERE auto_issued;

-- 3) New signups start pending, and carry their email through
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(public.profiles.email, EXCLUDED.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Approval side effects: role grant + automatic licence provisioning
CREATE OR REPLACE FUNCTION public.tg_apply_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_key text;
BEGIN
  IF NEW.approval_status = OLD.approval_status THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'editor')
    ON CONFLICT (user_id, role) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM public.licenses
       WHERE owner_user_id = NEW.id AND auto_issued
    ) THEN
      new_key := 'AETHER-' || upper(encode(gen_random_bytes(4), 'hex'))
              || '-' || upper(encode(gen_random_bytes(4), 'hex'))
              || '-' || upper(encode(gen_random_bytes(4), 'hex'));
      INSERT INTO public.licenses (
        license_key, client_name, client_email, max_activations,
        owner_user_id, auto_issued, notes
      ) VALUES (
        new_key,
        COALESCE(NEW.display_name, split_part(COALESCE(NEW.email, 'client'), '@', 1)),
        COALESCE(NEW.email, ''),
        1,
        NEW.id,
        true,
        'Auto-issued on admin approval'
      );
    ELSE
      UPDATE public.licenses
         SET status = 'active'
       WHERE owner_user_id = NEW.id AND auto_issued;
    END IF;

  ELSIF NEW.approval_status = 'rejected' THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'editor';
    UPDATE public.licenses
       SET status = 'suspended'
     WHERE owner_user_id = NEW.id AND auto_issued;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_apply_approval ON public.profiles;
CREATE TRIGGER profiles_apply_approval
  AFTER UPDATE OF approval_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_approval();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Access rules
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS licenses_read_own ON public.licenses;
CREATE POLICY licenses_read_own ON public.licenses
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS activations_read_own ON public.license_activations;
CREATE POLICY activations_read_own ON public.license_activations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.licenses l
                  WHERE l.id = license_activations.license_id
                    AND l.owner_user_id = auth.uid()));

-- 6) Content creation requires an approved account
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _user_id AND approval_status = 'approved'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM anon;

DROP POLICY IF EXISTS ar_experiences_insert_editor ON public.ar_experiences;
CREATE POLICY ar_experiences_insert_editor ON public.ar_experiences
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_approved(auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = auth.uid()
                   AND ur.role IN ('editor', 'admin'))
  );