CREATE TABLE IF NOT EXISTS public.design_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_catalogs_owner_idx
  ON public.design_catalogs (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.design_catalogs(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text NOT NULL,
  category text NOT NULL CHECK (category IN ('furniture', 'paint', 'flooring')),
  glb_path text NOT NULL,
  usdz_path text NOT NULL,
  thumb_path text,
  width_m numeric(6,2) NOT NULL CHECK (width_m > 0),
  height_m numeric(6,2) NOT NULL CHECK (height_m > 0),
  depth_m numeric(6,2) NOT NULL CHECK (depth_m > 0),
  color_hex text,
  placement text NOT NULL CHECK (placement IN ('floor', 'wall')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_items_catalog_idx
  ON public.catalog_items (catalog_id, sort_order, is_active);

CREATE INDEX IF NOT EXISTS catalog_items_owner_idx
  ON public.catalog_items (owner_id, created_at DESC);

ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scan_events_catalog_item_idx
  ON public.scan_events (catalog_item_id, created_at DESC);

GRANT SELECT ON public.design_catalogs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.design_catalogs TO authenticated;
GRANT ALL ON public.design_catalogs TO service_role;

GRANT SELECT ON public.catalog_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;

ALTER TABLE public.design_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "design_catalogs_owner_or_admin" ON public.design_catalogs;
CREATE POLICY "design_catalogs_owner_or_admin" ON public.design_catalogs
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "design_catalogs_public_read_active" ON public.design_catalogs;
CREATE POLICY "design_catalogs_public_read_active" ON public.design_catalogs
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "catalog_items_owner_or_admin" ON public.catalog_items;
CREATE POLICY "catalog_items_owner_or_admin" ON public.catalog_items
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "catalog_items_public_read_active" ON public.catalog_items;
CREATE POLICY "catalog_items_public_read_active" ON public.catalog_items
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "scan_events_catalog_item_read" ON public.scan_events;
CREATE POLICY "scan_events_catalog_item_read" ON public.scan_events
  FOR SELECT TO authenticated
  USING (
    (catalog_item_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.catalog_items ci
      WHERE ci.id = scan_events.catalog_item_id
        AND ci.owner_id = auth.uid()
    ))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "scan_events_catalog_item_insert" ON public.scan_events;
CREATE POLICY "scan_events_catalog_item_insert" ON public.scan_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (catalog_item_id IS NULL OR EXISTS (
      SELECT 1 FROM public.catalog_items ci
      WHERE ci.id = catalog_item_id AND ci.is_active = true
    ))
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_design_catalogs_updated_at ON public.design_catalogs;
CREATE TRIGGER set_design_catalogs_updated_at
BEFORE UPDATE ON public.design_catalogs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER set_catalog_items_updated_at
BEFORE UPDATE ON public.catalog_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
