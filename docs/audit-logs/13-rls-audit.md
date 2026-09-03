# 13 RLS Audit

## Status
PARTIAL

## Blueprint Requirement
"RLS is enabled on every customer table and tested against both owner and cross-tenant access."

## Repository Evidence
- Migrations: `supabase/migrations/`
- Schema: `supabase/client-schema.sql`
- Tests: `tests/rls-regression.test.ts`
- Server queries: `src/lib/catalog.functions.ts`

## Findings
RLS policies exist for catalog and related tables, including owner/admin and public-active paths. A complete live table-by-table negative test run is not evidenced.

## Risk
Critical

## Fix Required
Run isolated Supabase RLS tests for every customer table and publish the results.

## Suggested Commit
`test: enforce complete tenant RLS coverage`
