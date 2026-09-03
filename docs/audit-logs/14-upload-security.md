# 14 Upload Security

## Status
PARTIAL

## Blueprint Requirement
"Upload and download paths are tenant-scoped and time-limited."

## Repository Evidence
- Guard: `src/lib/uploader-guard.server.ts`
- Signing: `src/lib/catalog.functions.ts`, `src/lib/experiences.functions.ts`
- Tests: `tests/upload-security.test.ts`
- Storage: `src/lib/storage.server.ts`

## Findings
Path scoping, authorization, and signed upload flow have focused evidence. Complete live provider tests for MIME, size, expiry, overwrite, and traversal behavior are not proven.

## Risk
High

## Fix Required
Add provider-backed upload abuse tests and enforce all asset limits server-side.

## Suggested Commit
`test: verify provider-backed upload security`
