-- The view ran with owner privileges (security definer semantics), which the
-- linter flags. Public gallery reads happen server-side with an explicit safe
-- column list instead, so no anon-facing database object is needed at all.
-- DOWN: recreate public.public_experiences and grant SELECT to anon.
DROP VIEW IF EXISTS public.public_experiences;
