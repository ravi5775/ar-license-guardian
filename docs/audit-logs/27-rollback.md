# 27 Rollback

## Status
PARTIAL

## Blueprint Requirement
"Record release metadata and retain the previous known-good artifact."

## Repository Evidence
- Workflows: `.github/workflows/`
- Scripts: `scripts/post-deploy-smoke.mjs`, `scripts/verify-restore.sh`
- Docs: `RUNBOOK.md`, `docs/disaster-recovery.md`

## Findings
Rollback and restore documentation/scripts exist, but a failed-release rollback drill with measured result is not evidenced.

## Risk
High

## Fix Required
Run and record an immutable artifact rollback including schema compatibility and health verification.

## Suggested Commit
`test: verify production rollback drill`
