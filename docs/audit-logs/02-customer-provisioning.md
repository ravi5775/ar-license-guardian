# 02 Customer Provisioning

## Status
PARTIAL

## Blueprint Requirement
"Automated smoke tests verify login, dashboard access, upload signing, public delivery, license activation, and revocation behavior."

## Repository Evidence
- Scripts: `scripts/provision-client.mjs`, `scripts/bootstrap-admin.mjs`
- Workflows: `.github/workflows/deploy-self-hosted.yml`, `.github/workflows/deploy-main.yml`
- Docs: `docs/onboarding.md`, `HANDOVER.md`

## Findings
Provisioning scripts and handover material exist. A clean customer provisioning run with all required smoke-test evidence is not verified because the E2E fixture requires unavailable Supabase credentials.

## Risk
Critical

## Fix Required
Create an isolated provisioning test that starts from empty infrastructure and records every required output and smoke check.

## Suggested Commit
`test: prove clean customer provisioning end to end`
