# 24 Build Identity

## Status
PARTIAL

## Blueprint Requirement
"Build with customer ID, build ID, release hash, and asset digest injected."

## Repository Evidence
- Runtime: `src/lib/adapters/licence-runtime.ts`
- Workflow: `.github/workflows/release-client-app.yml`
- Script: `scripts/sign-manifest.mjs`
- Config/docs: `vite.config.ts`, `CLIENT_README.md`

## Findings
Build ID is referenced in release configuration. Required customer and release identity injection is not consistently runtime-verified across the release workflow.

## Risk
Critical

## Fix Required
Validate all four identities before build and assert that the resulting manifest matches the bundle.

## Suggested Commit
`fix: enforce complete client build identity`
