# 12 Secrets Audit

## Status
PARTIAL

## Blueprint Requirement
"The customer deployment must not contain vendor private keys, service-role credentials, or unrestricted storage credentials."

## Repository Evidence
- Environment reads: `src/lib/storage.server.ts`, `src/lib/adapters/`, `src/integrations/supabase/`
- Workflows: `.github/workflows/`
- Scripts: `scripts/`
- Tests: `tests/env-and-adapters.test.ts`

## Findings
Environment handling is tested in places, but module-scope server secret reads remain a documented production concern. Bundle-level secret scanning is runtime not verified.

## Risk
Critical

## Fix Required
Move edge-sensitive reads into runtime-bound handlers and add a clean bundle secret scan gate.

## Suggested Commit
`fix: make secret configuration runtime safe`
