-- ============================================================================
-- AETHER AR — CLIENT INSTANCE MINIMAL DATABASE SCHEMA (6 Core Tables)
-- ============================================================================
-- Single-tenant / per-client lightweight database setup.
-- Total initial database size: < 5 MB.
-- Compatible with Supabase Free Tier (500 MB limit) & standard PostgreSQL.
-- ============================================================================

-- 1. EXTENSIONS & ROLE ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  storage_quota_bytes bigint NOT NULL DEFAULT (2::bigint * 1024 * 1024 * 1024), -- 2 GB
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Trigger: auto-create profile and assign admin role to the first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'editor');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_owner_idx ON public.projects (owner_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_owner_all" ON public.projects;
CREATE POLICY "projects_owner_all" ON public.projects
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 5. ALBUMS TABLE (Multi-Target AR)
CREATE TABLE IF NOT EXISTS public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  compiled_mind_url text,
  compiled_mind_path text,
  target_count integer NOT NULL DEFAULT 0,
  access_mode text NOT NULL DEFAULT 'public',
  pin_hash text,
  pin_expires_at timestamptz,
  single_use_media boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  show_in_gallery boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS albums_owner_idx ON public.albums (owner_id);
CREATE INDEX IF NOT EXISTS albums_slug_idx ON public.albums (slug);

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "albums_public_read" ON public.albums;
CREATE POLICY "albums_public_read" ON public.albums
  FOR SELECT TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "albums_owner_all" ON public.albums;
CREATE POLICY "albums_owner_all" ON public.albums
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6. AR EXPERIENCES TABLE (Single & Album-Linked Scenes)
CREATE TABLE IF NOT EXISTS public.ar_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  target_index integer,
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  cover_image_url text,
  marker_url text,
  marker_path text,
  marker_mind_path text,
  media_url text,
  media_path text,
  media_type text NOT NULL DEFAULT 'video',
  autoplay boolean NOT NULL DEFAULT true,
  loop_playback boolean NOT NULL DEFAULT true,
  access_mode text NOT NULL DEFAULT 'public',
  pin_hash text,
  pin_expires_at timestamptz,
  single_use_media boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  show_in_gallery boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_album_target UNIQUE (album_id, target_index)
);

CREATE INDEX IF NOT EXISTS ar_experiences_owner_idx ON public.ar_experiences (owner_id);
CREATE INDEX IF NOT EXISTS ar_experiences_slug_idx ON public.ar_experiences (slug);
CREATE INDEX IF NOT EXISTS ar_experiences_album_idx ON public.ar_experiences (album_id);

ALTER TABLE public.ar_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ar_experiences_public_read" ON public.ar_experiences;
CREATE POLICY "ar_experiences_public_read" ON public.ar_experiences
  FOR SELECT TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "ar_experiences_owner_all" ON public.ar_experiences;
CREATE POLICY "ar_experiences_owner_all" ON public.ar_experiences
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7. MEDIA ACCESS NONCES TABLE (Single-use Link Protection)
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

CREATE INDEX IF NOT EXISTS media_access_nonces_expires_idx ON public.media_access_nonces (expires_at);

ALTER TABLE public.media_access_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_access_nonces_deny_all" ON public.media_access_nonces;
CREATE POLICY "media_access_nonces_deny_all" ON public.media_access_nonces
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

GRANT ALL ON public.media_access_nonces TO service_role;

-- RPC: Atomic Nonce Consumption
CREATE OR REPLACE FUNCTION public.consume_media_nonce(_nonce_hash text)
RETURNS TABLE (storage_path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.media_access_nonces%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.media_access_nonces
  WHERE nonce_hash = _nonce_hash
    AND consumed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.media_access_nonces
  SET consumed_at = now()
  WHERE id = _row.id;

  RETURN QUERY SELECT _row.storage_path;
END;
$$;
