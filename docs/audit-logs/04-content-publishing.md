# 04 Content Publishing

## Status
PASS

## Blueprint Requirement
"The server scopes upload paths to the authorized tenant and returns a short-lived signed upload URL."

## Repository Evidence
- Functions: `src/lib/catalog.functions.ts`, `src/lib/experiences.functions.ts`
- Upload guard: `src/lib/uploader-guard.server.ts`
- Tests: `tests/upload-security.test.ts`, `tests/catalog-feature.test.ts`
- Routes: `src/routes/_authenticated/dashboard.catalogs.tsx`

## Findings
Upload signing, metadata validation, catalog editing, and public active-state flows have implementation and focused test evidence. Full production storage-provider execution remains deployment-dependent.

## Risk
Medium

## Fix Required
Retain the focused tests and add a live storage smoke test to the deployment gate.

## Suggested Commit
`test: add live content publishing smoke coverage`
