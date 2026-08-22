ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS customer_id text;
ALTER TABLE public.license_activations ADD COLUMN IF NOT EXISTS release_hash text;
ALTER TABLE public.license_activations ADD COLUMN IF NOT EXISTS customer_id text;
CREATE INDEX IF NOT EXISTS licenses_customer_id_idx ON public.licenses (customer_id);