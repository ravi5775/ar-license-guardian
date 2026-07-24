CREATE TABLE public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  owner_id uuid NOT NULL,
  compiled_mind_path text,
  compiled_mind_url text,
  target_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT SELECT ON public.albums TO anon;
GRANT ALL ON public.albums TO service_role;

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published albums"
  ON public.albums FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Owners and admins can read albums"
  ON public.albums FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Owners and admins can insert albums"
  ON public.albums FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Owners and admins can update albums"
  ON public.albums FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Owners and admins can delete albums"
  ON public.albums FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE TRIGGER albums_set_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.ar_experiences
  ADD COLUMN album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  ADD COLUMN target_index integer;

ALTER TABLE public.ar_experiences ALTER COLUMN slug DROP NOT NULL;

CREATE INDEX ar_experiences_album_idx ON public.ar_experiences (album_id, target_index);

ALTER TABLE public.ar_experiences
  ADD CONSTRAINT ar_experiences_album_target_unique UNIQUE (album_id, target_index);