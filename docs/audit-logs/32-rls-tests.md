# 32 RLS Tests

## Status
PARTIAL

## Blueprint Requirement
"RLS is enabled on every customer table and tested against both owner and cross-tenant access."

## Repository Evidence
- Test: `tests/rls-regression.test.ts`
- Migrations: `supabase/migrations/`
- Schema: `supabase/client-schema.sql`
- Workflow: `.github/workflows/ci.yml`

## Findings
An RLS regression suite exists, but CI conditionally skips database-backed checks when credentials are absent and no current successful live run is available.

## Risk
Critical

## Fix Required
Provision an isolated database in CI and fail the job when RLS tests are skipped.

## Suggested Commit
`ci: make RLS regression tests mandatory`
