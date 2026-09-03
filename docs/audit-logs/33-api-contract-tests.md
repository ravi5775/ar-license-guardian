# 33 API Contract Tests

## Status
PARTIAL

## Blueprint Requirement
"API contract tests for activation, manifest, presigning, and revocation."

## Repository Evidence
- Test: `tests/api-contract.test.ts`
- Routes: `src/routes/api/public/`
- License code: `src/lib/adapters/`
- Upload code: `src/lib/experiences.functions.ts`, `src/lib/catalog.functions.ts`

## Findings
API contract and focused license/presign tests exist. A complete live contract run covering every required endpoint and deployment configuration is not proven.

## Risk
High

## Fix Required
Add activation, manifest, presign, and revocation cases to one required environment-backed contract job.

## Suggested Commit
`test: complete license and media API contract coverage`
