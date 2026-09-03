# 29 Deployment Secrets

## Status
PARTIAL

## Blueprint Requirement
"The customer deployment must not contain vendor private keys, service-role credentials, or unrestricted storage credentials."

## Repository Evidence
- Workflows: `.github/workflows/`
- Client strip: `scripts/strip-client-app.sh`
- Environment tests: `tests/env-and-adapters.test.ts`
- Storage: `src/lib/storage.server.ts`

## Findings
Secrets are referenced through workflow and server configuration paths. No current artifact scan proves that deployment secrets cannot enter the client bundle.

## Risk
Critical

## Fix Required
Add secret redaction checks, bundle scanning, and workflow log assertions to release protection.

## Suggested Commit
`ci: prevent deployment secret exposure`
