# 08 Data Model

## Status
PARTIAL

## Blueprint Requirement
"Every customer-owned row has an owner or tenant boundary" and RLS is enabled and tested.

## Repository Evidence
- Migrations: `supabase/migrations/`
- Schema: `supabase/client-schema.sql`, `supabase/client-schema.sql`
- Tests: `tests/rls-regression.test.ts`, `tests/catalog-feature.test.ts`
- Queries: `src/lib/catalog.functions.ts`, `src/lib/experiences.functions.ts`

## Findings
Catalog, experience, album, profile, role, event, and license-related structures exist. The full entity-to-policy-to-test matrix and isolated live RLS evidence are incomplete.

## Risk
High

## Fix Required
Publish a table inventory with RLS policy, owner boundary, public behavior, and positive/negative test for every entity.

## Suggested Commit
`test: complete blueprint data model and RLS matrix`
