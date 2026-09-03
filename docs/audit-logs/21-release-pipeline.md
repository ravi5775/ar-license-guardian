# 21 Release Pipeline

## Status
PARTIAL

## Blueprint Requirement
"Every customer release follows this sequence" from clean checkout through tests, signed artifact, smoke tests, and retention.

## Repository Evidence
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/release-client-app.yml`
- Scripts: `scripts/sign-manifest.mjs`, `scripts/strip-client-app.sh`, `scripts/verify-client-branch.mjs`
- Docs: `RUNBOOK.md`, `docs/hosting.md`

## Findings
The repository has release workflows and validation scripts. The full ordered sequence is not proven as one mandatory clean-environment pipeline.

## Risk
Critical

## Fix Required
Create one protected release workflow with explicit fail-fast stages and artifact retention.

## Suggested Commit
`ci: enforce complete customer release pipeline`
