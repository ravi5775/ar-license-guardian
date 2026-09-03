# 46 Key Rotation

## Status
PARTIAL

## Blueprint Requirement
"Key rotation ... runbooks" and signed manifests must remain verifiable during rotation.

## Repository Evidence
- Key script: `scripts/generate-licence-keypair.mjs`
- Signing: `scripts/sign-manifest.mjs`
- Docs: `docs/break-glass.md`, `RUNBOOK.md`
- Runtime: `src/lib/adapters/licence-runtime.ts`

## Findings
Key generation and signing exist. Overlap, migration, emergency replacement, and dual-key verification are not fully evidenced.

## Risk
High

## Fix Required
Implement and test a rotation protocol with old/new key overlap and rollback.

## Suggested Commit
`feat: add signing key rotation protocol`
