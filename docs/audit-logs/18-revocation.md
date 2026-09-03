# 18 Revocation

## Status
PARTIAL

## Blueprint Requirement
"Suspension or revocation prevents new activation and new protected media delivery."

## Repository Evidence
- Gate: `src/lib/adapters/presign-gate.server.ts`
- Server: `src/lib/adapters/licence.server.ts`
- Routes: `src/routes/api/public/licence/`
- Tests: `tests/presign-gate.test.ts`, `tests/licence.test.ts`

## Findings
Revocation-aware server gates and tests exist. A live revoked-license-to-media-denial run and documented offline expiry behavior are not proven.

## Risk
High

## Fix Required
Add live revocation smoke coverage and verify both fresh and already-authorized sessions.

## Suggested Commit
`test: prove revocation blocks protected media`
