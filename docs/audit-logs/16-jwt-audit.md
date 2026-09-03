# 16 Token and JWT Audit

## Status
PARTIAL

## Blueprint Requirement
"Short-lived signed media URLs, device/session binding, and revocation checks."

## Repository Evidence
- License server: `src/lib/adapters/licence.server.ts`
- Runtime: `src/lib/adapters/licence-runtime.ts`
- Tests: `tests/licence.test.ts`, `tests/presign-gate.test.ts`

## Findings
Signed token and expiry logic is present. Complete replay, logout, clock-skew, origin-binding, and refresh abuse evidence is not available.

## Risk
High

## Fix Required
Add negative contract tests for replay, wrong origin/device, expired refresh, and clock skew.

## Suggested Commit
`test: harden token replay and refresh coverage`
