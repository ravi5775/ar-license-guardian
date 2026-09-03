# 17 Device Fingerprint

## Status
PARTIAL

## Blueprint Requirement
"Client activation validates the license, device fingerprint, origin, build, and manifest."

## Repository Evidence
- Runtime: `src/lib/adapters/licence-runtime.ts`
- License paths: `src/lib/adapters/licence.server.ts`
- Audit script: `scripts/audit/p03-licence-lifecycle.sh`
- Tests: `tests/licence.test.ts`

## Findings
Fingerprint generation and activation inputs exist. Rotation, privacy retention, and spoofing resistance are not fully demonstrated.

## Risk
Medium

## Fix Required
Document fingerprint properties and test rotation, duplicate devices, and privacy-safe retention.

## Suggested Commit
`test: verify device binding and fingerprint rotation`
