# Aether AR License Guardian — Complete Enterprise Audit Report

**Audit date:** 2026-09-04  
**Repository:** `ravi5775/ar-license-guardian`  
**Commit under review:** `f934a05` plus uncommitted working-tree changes  
**Audit mode:** zero-trust, evidence-first  
**Verdict:** **NOT READY FOR A CLEAN PRODUCTION PASS**  
**Evidence status:** **CONDITIONAL_PASS by the repository runner, score 0/100, 8 phases NOT_VERIFIED**

> This report records what was actually inspected and executed. A passing source test or build is not treated as proof of production security, deployment correctness, tenant isolation, or licensing enforcement.

## 1. Executive summary

Aether AR has a strong application foundation: TanStack Start, React, Supabase/PostgreSQL, RLS migrations, private-storage-oriented adapters, signed licensing concepts, rate limiting, security headers, a vendor worker, and a meaningful automated test suite.

The repository is not currently a 10/10 or production-ready release because several controls are either incomplete, inconsistent, or not externally verified:

1. The evidence-gated audit runner produced no PASS phases.
2. `gitleaks`, `osv-scanner`, `k6`, and `autocannon` were unavailable.
3. PostgreSQL was detected but no audit artifact was produced.
4. The audit runner checks tool versions and existing artifacts rather than executing the required security/load/database commands.
5. The full test command reports 160 passing tests but exits with code 99 and requires investigation.
6. Build profiles compile successfully, but profile flags are only partially wired and do not by themselves remove server routes or issuer code.
7. Release/deployment workflows still have stale or inconsistent assumptions.
8. MFA enrollment, RLS policy correctness, private media URL enforcement, audit-event authenticity, and vendor-worker contract behavior require targeted negative and integration tests.

## 2. Rating

| Area | Score | Basis |
|---|---:|---|
| Architecture | 7.5/10 | Clear major boundaries, but profile/runtime and deployment contracts diverge. |
| Code quality | 7/10 | Typed application with useful tests; legacy paths and inconsistent conventions remain. |
| Authentication | 7/10 | Supabase Auth and AAL2 checks exist; mandatory MFA enrollment is not proven. |
| Authorization and tenant isolation | 7/10 | RLS migrations and server checks exist; live catalog verification is unavailable. |
| API security | 6.5/10 | Validation and CORS exist; legacy paths and rate-limit coverage need reconciliation. |
| License security | 6.5/10 | Signed manifests and fingerprint controls exist; full lifecycle is not integration-proven. |
| Rate limiting | 6/10 | Budgets were partly aligned; provider and ingress behavior are not externally verified. |
| Upload security | 8.5/10 | Magic-byte, extension, size, and traversal tests pass. |
| Database/RLS | 6.5/10 | Migrations are substantial; no live external RLS artifact was produced. |
| Secrets and privacy | 7/10 | Runtime secret handling improved; full-history scan and URL/privacy review remain open. |
| Testing | 6.5/10 | 160 tests report passing, but the command exits 99 and staging/device tests are absent. |
| CI/CD | 6/10 | Multiple workflows exist; profile, release, and evidence gates are inconsistent. |
| Observability | 5.5/10 | Logging and diagnostics exist; production alert evidence is missing. |
| Disaster recovery | 5/10 | Scripts and documentation exist; restore evidence is not verified. |
| Performance/scalability | 5/10 | No staging load, cold-start, R2, heap, or CPU artifacts. |
| Documentation/handover | 6.5/10 | Core documents exist; stale branch/output references remain. |
| Ethical-use readiness | 5.5/10 | Policy plan exists; implemented moderation, review, appeal, and retention evidence is absent. |

**Overall rating: 6.4/10 (64/100)**  

This manual rating is deliberately higher than the evidence runner's score of 0 because the runner had no phase artifacts. It must not be interpreted as a production approval.

## 3. Evidence actually collected

### PASS

- TypeScript typecheck completed successfully.
- `bun run build:admin` completed successfully.
- `bun run build:client` completed successfully.
- `bun run build:selfhost` completed successfully.
- `git diff --check` completed successfully.
- Script syntax checks completed successfully.
- The test output reported **160 passing tests and 0 failing tests** across 12 files.

### FAIL / unresolved

- `bun test` reported 160 passes but exited with code **99**. The nonzero exit must be diagnosed before release.
- Full `bun run lint` exceeded the execution window and was not independently confirmed clean.

### NOT_VERIFIED

The existing evidence runner returned:

```text
CONDITIONAL_PASS score=0 notVerified=8 failed=0
```

| Phase | Tool | Result | Reason |
|---|---|---|---|
| S01 | gitleaks | NOT_VERIFIED | Tool not on PATH. |
| S02 | osv-scanner | NOT_VERIFIED | Tool not on PATH. |
| S03 | k6 | NOT_VERIFIED | Tool not on PATH. |
| S04 | autocannon | NOT_VERIFIED | Tool not on PATH. |
| S05 | psql | NOT_VERIFIED | No expected artifact produced. |
| S06 | node | NOT_VERIFIED | Tool ran, but no expected artifact existed. |
| S07 | bun | NOT_VERIFIED | Tool ran, but no expected artifact existed. |
| S08 | git | NOT_VERIFIED | Tool ran, but no expected artifact existed. |

No claims are made for live RLS, full-history secrets, dependency CVEs, rate-limit bursts, staging performance, client isolation, SRI, or audit-chain integrity.

## 4. Critical and high-priority findings

### H-01 — Mandatory administrator MFA enrollment is not proven

The route gate checks whether Supabase reports an AAL2 step-up requirement. An administrator without an enrolled factor may not have `nextLevel === "aal2"` and can therefore avoid the intended enrollment requirement.

**Impact:** privileged accounts may operate without mandatory MFA.  
**Required fix:** require every owner/admin to have a verified factor, deny or route unenrolled accounts to enrollment, and require AAL2 for sensitive mutations.  
**Required evidence:** negative tests for no factor, AAL1, AAL2, removed factor, and privileged mutation.

### H-02 — Build profile flags are not a complete security boundary

The profile module is imported by dashboard navigation, but feature flags do not remove all routes or protect all server functions. UI hiding cannot prevent direct route access or crafted server-function calls.

**Impact:** client builds may retain issuer/admin functionality or expose behavior that should be profile-disabled.  
**Required fix:** add server-side profile gates to every profile-sensitive route/function and verify generated client/server graphs.

### H-03 — RLS policy correctness requires live verification

The migrations add tenant-aware policies, but live catalog queries were not executed. Specific risks requiring tests include anonymous reads from suspended tenants, viewer writes through incomplete `WITH CHECK` clauses, and direct audit-event insertion.

**Impact:** cross-tenant disclosure, unauthorized writes, or forged audit records.  
**Required fix:** correct policies, revoke direct audit inserts, and run external PostgreSQL tests against staging.

### H-04 — Protected media must never fall back to permanent public URLs

Any configured public R2 base URL can bypass signed-download expiry and revocation semantics.

**Impact:** shared media URLs may remain accessible after authorization or licence revocation.  
**Required fix:** keep protected buckets private and issue only short-lived signed URLs, or implement expiring authenticated CDN tokens.

### H-05 — Vendor worker contract and lifecycle require integration proof

The client and worker have historically used different field naming and endpoint expectations. Activation, heartbeat, refresh, release, revocation, duplicate activation, and grace behavior need a single contract tested against the actual worker.

**Impact:** licence activation or revocation may fail open, fail closed incorrectly, or become operationally unusable.  
**Required fix:** publish one versioned contract and run activate → duplicate → revoke → grace → recovery integration tests.

### H-06 — Evidence runner does not execute the required audit checks

The runner mainly checks whether tools exist and whether pre-existing artifact filenames exist. It does not itself run gitleaks, OSV, k6, autocannon, or the required PostgreSQL catalog queries.

**Impact:** a future artifact could be mistaken for current external evidence.  
**Required fix:** each phase must execute its external command, capture stdout/stderr, record exit code, validate artifact freshness and schema, and fail when the command was not run.

## 5. Medium findings

### M-01 — Test command exits nonzero despite passing test lines

The suite reports 160 passes but returns code 99. This could indicate an unhandled rejection, coverage/runtime teardown issue, or test-runner integration problem.

**Action:** capture the complete exit output and make the command return zero only when the runner has no hidden failure.

### M-02 — Release workflow output paths and documentation have drift risk

The project uses `.output/public` for Vite/Nitro builds, while older release documentation and scripts refer to `dist` or `dist/client`.

**Action:** define one output contract and add a workflow assertion that the signed/uploaded directory exists and contains the expected profile metadata.

### M-03 — Cross-platform build behavior needs CI coverage

The build helper was added to avoid POSIX environment assignment, but Windows and Linux execution should both be tested in CI.

**Action:** run the profile helper on Windows and Ubuntu runners and assert the embedded profile.

### M-04 — Rate-limit ingress identity is infrastructure-dependent

Forwarding headers can be spoofed unless Cloudflare/Nginx strips and rewrites them.

**Action:** verify trusted ingress behavior and test activation, heartbeat, upload, public scan, and sign-in budgets against staging.

### M-05 — Full-history secret rotation is unverified

Current source scans cannot prove old commits are clean. Any historically exposed Supabase, R2, mail, worker, or signing credentials must be rotated.

**Action:** run gitleaks over all history, rotate exposed credentials, and record the result.

### M-06 — SRI and AR dependency verification is incomplete

Vendored AR files exist, but a release gate proving their hashes match an approved manifest was not executed.

**Action:** self-host or add exact SRI/checksum verification in CI and produce `artifacts/s9-sri.json`.

### M-07 — Production deployment gates need protected approval

Deployment workflows exist, but staging promotion, migration policy, rollback, health checks, and protected production environments require independent verification.

**Action:** require staging evidence and environment approval before production deployment.

### M-08 — Ethical-use controls remain primarily documented

The plan defines consent, moderation, human review, appeals, and privacy minimization, but implementation and operational evidence were not demonstrated.

**Action:** implement versioned policy decisions, human review queues, appeal state, retention controls, and audit-safe decision metadata.

## 6. Positive controls observed

- Tenant-aware migrations, RLS functions, and explicit-grant patterns are present.
- Admin checks were strengthened with an AAL2 assertion in the server guard.
- Licensing activation requires customer and release identity fields.
- Activation and heartbeat budgets were aligned with the supplied concrete limits.
- Audit events have hash-chain columns and a trigger-based hash calculation.
- Upload tests cover valid signatures, spoofed extensions, disallowed extensions, and traversal.
- Security headers include CSP, HSTS, MIME sniffing protection, referrer policy, and camera permissions.
- Build profiles compile successfully through the current Vite/Nitro setup.
- Audit and deployment tooling is separated from application source.

## 7. Required remediation sequence

1. Diagnose the `bun test` exit code 99 and obtain a clean zero exit.
2. Create a named remediation branch and preserve the current uncommitted changes.
3. Implement mandatory MFA enrollment and complete AAL2 negative tests.
4. Centralize profile/runtime configuration and enforce it server-side.
5. Correct RLS `USING`/`WITH CHECK` policies and revoke direct audit inserts.
6. Remove permanent public media URL behavior.
7. Reconcile the vendor worker/client API and test the complete licence lifecycle.
8. Make the evidence runner execute real commands and validate fresh artifacts.
9. Add Windows/Linux profile CI, staging deployment, rollback, backup, and restore gates.
10. Run gitleaks, OSV, npm/Bun audit, SRI, k6, autocannon, psql, R2, CPU, heap, and cold-start checks.
11. Complete Android/iPhone AR testing and document camera-denial fallback.
12. Implement ethical-use review, consent, appeals, retention, and human-governance controls.
13. Consolidate stale documentation and remove remaining branch/output assumptions.
14. Re-run the full evidence-gated audit and publish the final readiness report.

## 8. Release gate

Do not release to production until:

- no critical or unresolved high findings remain;
- `bun test` returns zero;
- lint returns zero;
- all three profile builds pass;
- live RLS and role tests pass;
- signed media URL expiry/revocation tests pass;
- licence lifecycle integration passes;
- full-history secret scan and dependency scan pass;
- rate-limit burst tests pass;
- client isolation and SRI checks pass;
- staging deployment, backup restore, rollback, and observability checks pass;
- real-device AR checks pass;
- every claimed phase has fresh external evidence;
- all missing evidence is explicitly listed as `NOT_VERIFIED`.

## 9. Final decision

**Production decision: NO-GO at this time.**

The codebase is a credible enterprise foundation, but the current evidence and unresolved control gaps do not support a clean production approval or a 10/10 rating. The next approval review should be based on a fresh staging run with externally produced artifacts, not on source inspection or the current runner's `CONDITIONAL_PASS` label.

