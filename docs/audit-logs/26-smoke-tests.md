# 26 Smoke Tests

## Status
PARTIAL

## Blueprint Requirement
"Run smoke tests for authentication, activation, refresh, upload signing, public delivery, revocation, and rollback."

## Repository Evidence
- Scripts: `scripts/post-deploy-smoke.mjs`, `scripts/audit/`
- Workflows: `.github/workflows/deploy-main.yml`, `.github/workflows/deploy-self-hosted.yml`
- E2E: `e2e/`

## Findings
Smoke-test scripts and focused E2E tests exist. The complete deployment sequence cannot be proven without configured live credentials and an environment.

## Risk
High

## Fix Required
Make all seven checks required and publish an artifact containing their responses and deployment SHA.

## Suggested Commit
`ci: require complete post-deploy smoke tests`
