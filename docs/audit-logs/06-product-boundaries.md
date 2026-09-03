# 06 Product Boundaries

## Status
PARTIAL

## Blueprint Requirement
"Server-side authorization on every mutation; UI hiding is not authorization."

## Repository Evidence
- Auth: `src/integrations/supabase/auth-middleware.ts`
- Functions: `src/lib/catalog.functions.ts`, `src/lib/experiences.functions.ts`
- Policies: `supabase/migrations/20260829000000_room_catalog_schema.sql`
- Routes: `src/routes/_authenticated/`, `src/routes/ar.$slug.tsx`

## Findings
Authenticated server functions and RLS policies separate public and owner paths. Cross-role and cross-tenant denial is not comprehensively demonstrated for every route and mutation.

## Risk
High

## Fix Required
Create a route/function authorization matrix and negative tests for each product boundary.

## Suggested Commit
`test: add product-boundary authorization matrix`
