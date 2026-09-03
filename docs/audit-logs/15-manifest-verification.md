# 15 Manifest Verification

## Status
PARTIAL

## Blueprint Requirement
"Ed25519-signed manifests and license tokens with default-deny verification."

## Repository Evidence
- Verification: `src/routes/api/public/licence/manifest.ts`
- Runtime: `src/lib/adapters/licence-runtime.ts`
- Signing: `scripts/sign-manifest.mjs`
- Tests: `tests/licence.test.ts`

## Findings
Manifest signing and verification paths exist. Prior audit evidence raised a possible success path when signing configuration is absent, but the behavior was not demonstrated in this audit and remains runtime not verified.

## Risk
Critical

## Fix Required
Execute negative tests for missing keys, signature, identity, digest, and expiry. If fail-open behavior is reproduced, return an explicit failure and add regression tests.

## Suggested Commit
`fix: fail closed on missing manifest verification keys`
