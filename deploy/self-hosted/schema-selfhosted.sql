-- Aether AR — self-hosted (Branch B) schema for plain PostgreSQL.
-- Structurally mirrors the managed (Supabase) schema, but auth is self-managed
-- and RLS uses a session variable (app.current_user_id) instead of auth.uid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: the app sets `SET LOCAL app.current_user_id = '<uuid>'` per request.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE,
  password_hash text,
  google_sub text UNIQUE,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE app_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compiled_mind_url text,
  target_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ar_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES albums(id) ON DELETE CASCADE,
  target_index integer,
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  cover_image_url text,
  marker_url text,
  media_url text,
  media_type text NOT NULL DEFAULT 'video',
  autoplay boolean NOT NULL DEFAULT true,
  loop_playback boolean NOT NULL DEFAULT true,
  published boolean NOT NULL DEFAULT false,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (album_id, target_index)
);

CREATE TABLE licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  client_name text NOT NULL,
  fingerprint text,
  max_activations integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE license_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL,
  fingerprint text NOT NULL,
  ip_address inet,
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_limit_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  key text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);

-- Row-level security (native Postgres, session-variable identity).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- licenses / license_activations / rate_limit_hits are never exposed to the
-- app connection; only the privileged migration/admin role touches them.
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users FOR SELECT
  USING (id = app_current_user_id() OR has_role(app_current_user_id(), 'admin'));

CREATE POLICY roles_self ON user_roles FOR SELECT
  USING (user_id = app_current_user_id() OR has_role(app_current_user_id(), 'admin'));

CREATE POLICY albums_public_read ON albums FOR SELECT USING (published);
CREATE POLICY albums_owner_all ON albums FOR ALL
  USING (owner_id = app_current_user_id() OR has_role(app_current_user_id(), 'admin'))
  WITH CHECK (owner_id = app_current_user_id() OR has_role(app_current_user_id(), 'admin'));

CREATE POLICY experiences_public_read ON ar_experiences FOR SELECT USING (published);
CREATE POLICY experiences_owner_all ON ar_experiences FOR ALL
  USING (owner_id = app_current_user_id() OR has_role(app_current_user_id(), 'admin'))
  WITH CHECK (owner_id = app_current_user_id() OR has_role(app_current_user_id(), 'admin'));

CREATE POLICY audit_insert ON audit_log FOR INSERT
  WITH CHECK (user_id = app_current_user_id());
CREATE POLICY audit_admin_read ON audit_log FOR SELECT
  USING (has_role(app_current_user_id(), 'admin'));
