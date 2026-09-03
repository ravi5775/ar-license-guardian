# 03 Guest Playback

## Status
PARTIAL

## Blueprint Requirement
"The guest uses MindAR/WebAR when supported, or direct-video/fallback camera mode when tracking or browser support is unavailable."

## Repository Evidence
- Routes: `src/routes/ar.$slug.tsx`, `src/routes/ar.album.$slug.tsx`, `src/routes/scan.tsx`
- Runtime: `src/lib/adapters/licence-runtime.ts`
- Media gate: `src/lib/adapters/presign-gate.server.ts`
- Tests: `tests/api-contract.test.ts`, `tests/licence.test.ts`

## Findings
Public AR routes, license runtime, and media gating are implemented. Full QR-to-playback behavior on real supported devices and failure paths is not proven by mandatory E2E evidence.

## Risk
High

## Fix Required
Add configured browser and device tests covering QR navigation, activation, signed media delivery, AR fallback, and analytics.

## Suggested Commit
`test: cover guest playback journey across supported browsers`
