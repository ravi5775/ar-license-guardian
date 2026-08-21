-- Add customer_id and files manifest to release_manifests
ALTER TABLE public.release_manifests
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS files jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mismatch_count integer NOT NULL DEFAULT 0;

-- Composite unique constraint on customer_id + build_id if customer_id provided, or build_id
CREATE INDEX IF NOT EXISTS idx_release_manifests_customer_build
  ON public.release_manifests (customer_id, build_id);

COMMENT ON COLUMN public.release_manifests.files IS 'Array of file paths and their SHA-384 hashes for fine-grained tamper analysis';
COMMENT ON COLUMN public.release_manifests.mismatch_count IS 'Counter of integrity mismatch detections reported by client heartbeats';
