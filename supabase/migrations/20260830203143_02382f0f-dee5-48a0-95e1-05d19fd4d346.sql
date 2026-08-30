CREATE TABLE IF NOT EXISTS public.design_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_catalogs TO authenticated;
GRANT ALL ON public.design_catalogs TO service_role;
ALTER TABLE public.design_catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_catalogs_owner_all" ON public.design_catalogs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS design_catalogs_owner_idx ON public.design_catalogs (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.design_catalogs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text NOT NULL,
  category text NOT NULL CHECK (category IN ('furniture','paint','flooring')),
  glb_path text NOT NULL,
  usdz_path text NOT NULL,
  thumb_path text,
  width_m numeric NOT NULL CHECK (width_m > 0),
  height_m numeric NOT NULL CHECK (height_m > 0),
  depth_m numeric NOT NULL CHECK (depth_m > 0),
  color_hex text,
  placement text NOT NULL CHECK (placement IN ('floor','wall')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, sku)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_items_owner_all" ON public.catalog_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS catalog_items_catalog_idx ON public.catalog_items (catalog_id, sort_order);

DROP TRIGGER IF EXISTS update_design_catalogs_updated_at ON public.design_catalogs;
CREATE TRIGGER update_design_catalogs_updated_at BEFORE UPDATE ON public.design_catalogs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS update_catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER update_catalog_items_updated_at BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.scan_events DROP CONSTRAINT IF EXISTS scan_events_subject_present;
ALTER TABLE public.scan_events ADD CONSTRAINT scan_events_subject_present
  CHECK (album_id IS NOT NULL OR experience_id IS NOT NULL OR catalog_item_id IS NOT NULL);

ALTER TABLE public.scan_events DROP CONSTRAINT IF EXISTS scan_events_event_type_check;
ALTER TABLE public.scan_events ADD CONSTRAINT scan_events_event_type_check
  CHECK (event_type IN ('album_open','target_found','playback_start','playback_complete','recognition_timeout','ar_place'));