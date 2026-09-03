# 28 Release Workflows

## Status
PARTIAL

## Blueprint Requirement
"Start from a clean, reproducible checkout" and enforce every release stage.

## Repository Evidence
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/release-client-app.yml`, `.github/workflows/deploy-main.yml`
- Security workflow: `.github/workflows/codeql.yml`
- Config: `package.json`

## Findings
CI, deployment, release, and CodeQL workflows are present. Bun-dependent tests and conditional secret-based stages mean mandatory coverage is not consistently enforced.

## Risk
High

## Fix Required
Install/pin the required runtime and make skipped security, RLS, and E2E stages fail protected releases.

## Suggested Commit
`ci: make release quality gates mandatory`
