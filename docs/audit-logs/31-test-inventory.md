# 31 Test Inventory

## Status
PASS

## Blueprint Requirement
"Unit and security regression tests" plus API, RLS, browser, build, and deployment verification.

## Repository Evidence
- Tests: `tests/api-contract.test.ts`, `tests/catalog-feature.test.ts`, `tests/comprehensive-security-regression.test.ts`, `tests/dto-sanitizer.test.ts`, `tests/env-and-adapters.test.ts`, `tests/licence.test.ts`, `tests/presign-gate.test.ts`, `tests/rate-limiter.test.ts`, `tests/rls-regression.test.ts`, `tests/security-critical-fixes.test.ts`, `tests/security-headers.test.ts`, `tests/upload-security.test.ts`
- E2E: `e2e/`
- Scripts: `package.json`

## Findings
A concrete unit/security/API/RLS/E2E inventory exists. Execution of the Bun test command is unavailable in this environment, so presence is proven but current pass results are not.

## Risk
Medium

## Fix Required
Run the inventory under the pinned project runtime and record results in CI artifacts.

## Suggested Commit
`ci: publish complete test inventory and results`
