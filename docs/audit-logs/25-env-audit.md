# 25 Environment Variables

## Status
PARTIAL

## Blueprint Requirement
"Missing signing keys, customer identity, release identity, or manifest data are hard failures, never warnings."

## Repository Evidence
- Environment reads: `src/`, `scripts/`, `vendor-worker/`
- Workflows: `.github/workflows/`
- Tests: `tests/env-and-adapters.test.ts`
- Docs: `CLIENT_README.md`, `docs/hosting.md`

## Findings
Environment reads and test coverage exist, but documentation and workflow requirements are not fully reconciled and runtime secret reads remain a validation concern.

## Risk
Critical

## Fix Required
Generate one checked-in environment contract and validate it in local, CI, and deployment workflows.

## Suggested Commit
`ci: validate release environment contract`
