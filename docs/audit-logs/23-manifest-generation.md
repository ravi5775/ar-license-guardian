# 23 Manifest Generation

## Status
PASS

## Blueprint Requirement
"Release automation signs a manifest containing customer ID, build ID, release hash, and asset digest."

## Repository Evidence
- Script: `scripts/sign-manifest.mjs`
- Key generation: `scripts/generate-licence-keypair.mjs`
- Tests/artifacts: `tests/licence.test.ts`, `artifacts/`

## Findings
A dedicated manifest signing script and key-generation flow are present. Production publication and verification still require deployment evidence.

## Risk
Medium

## Fix Required
Add a release test asserting all required fields and signature verification.

## Suggested Commit
`test: verify signed manifest fields and signatures`
