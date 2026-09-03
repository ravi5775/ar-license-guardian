# 22 Client Bundle

## Status
PARTIAL

## Blueprint Requirement
"Verify the client bundle contains no issuer secrets or forbidden server code."

## Repository Evidence
- Strip script: `scripts/strip-client-app.sh`
- Verification: `scripts/verify-client-branch.mjs`
- Workflow: `.github/workflows/release-client-app.yml`
- Config: `vite.config.ts`

## Findings
Client stripping and branch verification exist. A current generated-bundle scan with recorded clean output was not found.

## Risk
Critical

## Fix Required
Make bundle inspection mandatory and fail on private keys, service-role strings, issuer-only imports, and server secrets.

## Suggested Commit
`ci: enforce client bundle secret and import scan`
