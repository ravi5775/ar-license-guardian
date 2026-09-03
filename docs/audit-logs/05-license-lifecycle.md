# 05 License Lifecycle

## Status
PARTIAL

## Blueprint Requirement
"Suspension or revocation prevents new activation and new protected media delivery."

## Repository Evidence
- Runtime: `src/lib/adapters/licence-runtime.ts`
- Server: `src/lib/adapters/licence.server.ts`
- Gate: `src/lib/adapters/presign-gate.server.ts`
- Scripts: `scripts/sign-manifest.mjs`, `scripts/audit/p03-licence-lifecycle.sh`
- Tests: `tests/licence.test.ts`, `tests/presign-gate.test.ts`

## Findings
Token, activation, manifest, and presign components exist. A complete live sequence covering issue, refresh, suspension, revocation, and grace expiry was not executed.

## Risk
High

## Fix Required
Add a clean-environment license lifecycle test and record live issuer responses.

## Suggested Commit
`test: verify license lifecycle and revocation evidence`
