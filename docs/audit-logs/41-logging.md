# 41 Logging

## Status
PARTIAL

## Blueprint Requirement
"Structured logs for auth, license, upload, media, and public-route failures."

## Repository Evidence
- Source: `src/`, `vendor-worker/`
- Docs: `RUNBOOK.md`, `SECURITY.md`
- Tests: `tests/`

## Findings
Logging and audit paths exist across the application. A verified structured schema with correlation IDs for every required event was not found.

## Risk
Medium

## Fix Required
Define a common event schema, correlation ID propagation, redaction policy, and retention test.

## Suggested Commit
`feat: standardize structured operational logging`
