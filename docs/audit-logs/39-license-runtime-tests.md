# 39 License Runtime Tests

## Status
PARTIAL

## Blueprint Requirement
"Client activation validates the license, device fingerprint, origin, build, and manifest."

## Repository Evidence
- Runtime: `src/lib/adapters/licence-runtime.ts`
- Server: `src/lib/adapters/licence.server.ts`
- Tests: `tests/licence.test.ts`, `tests/presign-gate.test.ts`

## Findings
Core license runtime tests exist for token and gate behavior. Browser-level expiry, reconnect, offline, wrong-build, and revocation behavior is not fully covered.

## Risk
High

## Fix Required
Add browser and live issuer scenarios for activation, refresh, expiry, revocation, and reconnect.

## Suggested Commit
`test: complete license runtime lifecycle coverage`
