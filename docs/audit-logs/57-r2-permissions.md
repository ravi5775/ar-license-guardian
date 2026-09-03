# 57 R2 Bucket Permissions

## Status
PARTIAL

## Blueprint Requirement
"Upload and download paths are tenant-scoped and time-limited."

## Repository Evidence
- Storage: `src/lib/storage.server.ts`, `src/lib/uploader-guard.server.ts`
- Scripts: `scripts/check-r2-usage.mjs`, `scripts/create-r2-bucket.mjs`, `scripts/backup-to-r2.sh`
- Docs: `docs/hosting.md`

## Findings
Storage guards and R2 operational scripts exist. Actual bucket policies, public access state, CORS, lifecycle rules, and credential scope cannot be verified without provider configuration.

## Risk
High

## Fix Required
Capture bucket policy and CORS evidence, deny public writes, scope credentials, and test expired/unauthorized URLs.

## Suggested Commit
`ops: verify R2 least-privilege bucket configuration`
