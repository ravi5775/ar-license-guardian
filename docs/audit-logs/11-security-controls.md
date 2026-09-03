# 11 Security Controls

## Status
PARTIAL

## Blueprint Requirement
"Strict security headers ... approval checks, role separation, TOTP MFA ... rate limits ... signed manifests and tokens ... short-lived signed media URLs."

## Repository Evidence
- Middleware: `src/server.ts`
- Auth/MFA: `src/integrations/supabase/`, `src/routes/mfa.tsx`
- License/storage: `src/lib/adapters/`, `src/lib/storage.server.ts`
- Tests: `tests/security-headers.test.ts`, `tests/comprehensive-security-regression.test.ts`

## Findings
Multiple controls and regression tests exist. Complete production configuration and live verification of every control are not proven.

## Risk
High

## Fix Required
Map each control to a passing executable test and deployed configuration.

## Suggested Commit
`test: close security control evidence gaps`
